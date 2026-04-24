/**
 * APNs push notifications — permission flow + token registration + tap
 * handlers + iOS notification categories (Phase 3-A).
 *
 * This module owns the mobile-side contract with the backend's
 * `/v1/devices/register` endpoint (which itself lands in a separate
 * backend PR — contract only here; see JSDoc on
 * {@link registerDeviceWithBackend}).
 *
 * Why this file exists as a single surface (rather than spreading calls
 * across screens):
 *   - The three-step hand-off — permission → Expo token → backend POST —
 *     has to stay atomic. If we split it across screens each caller ends
 *     up re-implementing the branch for "permission denied", "Expo SDK
 *     not linked in dev simulator", and "backend 4xx". Centralising it
 *     keeps the retry / re-register-on-rotation logic in one place.
 *   - The last-known token persists via MMKV under
 *     `preferences.pushToken` (see {@link updatePersistedPushToken}) so
 *     the next app cold-start can detect token rotation and POST again
 *     without prompting the user.
 *   - iOS categories must be set up ONCE on mount, before any
 *     notification arrives (otherwise tapping an actionable notification
 *     falls back to the "default" behaviour with no Reply button). See
 *     {@link configureNotificationCategories}.
 *
 * ================== BACKEND CONTRACT (not implemented yet) ==================
 * The backend team will implement this endpoint in a follow-up PR; this
 * client is ready against the contract below.
 *
 *   POST /v1/devices/register
 *   Headers:
 *     Authorization: Bearer <access_token>
 *     Content-Type: application/json
 *   Body:
 *     {
 *       "device_id":  string (uuid),  // stable per-install identifier
 *       "push_token": string,         // Expo push token (ExponentPushToken[...])
 *       "platform":   "ios" | "android",
 *       "locale":     string          // e.g. "en", "es", "zh-Hans"
 *     }
 *   Response (200):
 *     { "ok": true }
 *
 * ============================================================================
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { getApiBaseUrl } from '@/lib/api';
import { loadPreferences, savePreferences } from '@/lib/persistence';
import type { PreferencesState } from '@/lib/types';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type DeviceMetadata = {
  /** Stable device UUID — reuse the same value `api.ts::getOrCreateDeviceId` mints. */
  deviceId: string;
  /** App locale at the time of registration (e.g. `en`, `es`, `zh-Hans`). */
  locale: string;
};

/**
 * Shape of the persisted "last known" push state — stored under the
 * preferences MMKV row so the next cold start can detect token rotation
 * without prompting the user again.
 *
 * We deliberately extend `PreferencesState` via a loose partial rather
 * than adding a new top-level key: Phase 3-A ships the data shape, but
 * the preferences slice reducer intentionally ignores unknown fields,
 * so this extension is forwards-compatible with Phase 3-D / M2+ without
 * a migration.
 */
export type PersistedPushRegistration = {
  pushToken: string;
  pushTokenRegisteredAt: string;
  pushPermissionStatus: PushPermissionStatus;
};

type PreferencesWithPush = Partial<PreferencesState> & Partial<PersistedPushRegistration>;

/**
 * Request APNs (iOS) / FCM (Android) notification permission. Wraps
 * `Notifications.requestPermissionsAsync` and flattens Expo's legacy
 * `ios.status` vs top-level `status` shape into the canonical three-way
 * `PushPermissionStatus` union.
 *
 * Call this AFTER a verify success — not at app launch. See the Phase
 * 3-A design note: first-launch prompts convert ~15-25% and sting the
 * psychological budget; post-verify prompts clear 60%+ because the user
 * has already committed to the account.
 */
export async function requestPushPermission(): Promise<PushPermissionStatus> {
  try {
    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    // Expo surfaces either `status` (AOSP) or `ios.status` (iOS — legacy
    // shape returned by expo-notifications <0.30 on older SDK targets).
    const iosStatus = (result as { ios?: { status?: string } }).ios?.status;
    const status = iosStatus ?? result.status;

    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    // Expo raises when the notifications native module isn't linked
    // (Expo Go on SDK 53+ disables push). Surface as `undetermined` so
    // the caller can gracefully show the primer banner on re-entry.
    return 'undetermined';
  }
}

/**
 * Probe the current permission status WITHOUT prompting. Used by the
 * VerifyScreen primer to decide whether to surface the "Turn on
 * notifications?" banner — only when the status is `undetermined`
 * (i.e. the user has not yet been asked). `denied` and `granted` skip
 * the banner because iOS doesn't let us re-prompt after a hard choice.
 */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  try {
    const result = await Notifications.getPermissionsAsync();
    const iosStatus = (result as { ios?: { status?: string } }).ios?.status;
    const status = iosStatus ?? result.status;

    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Fetch the Expo push token tied to this install. The token is the
 * opaque string (`ExponentPushToken[...]`) the backend POSTs to Expo's
 * push service, which then relays to APNs / FCM. The EAS project id is
 * pulled from `app.json::extra.eas.projectId` via `expo-constants` — the
 * project id lands there after `eas build:configure` runs (Phase 3-D).
 * Until then this will throw in production builds; the caller should
 * treat a throw as "not-registered-yet" and surface the primer again
 * on next launch.
 */
export async function registerDeviceForPush(): Promise<string> {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    eas?: { projectId?: string };
  };
  const projectId = extra.eas?.projectId;

  // `getExpoPushTokenAsync` accepts `projectId` only on EAS-built
  // binaries. In the simulator / Expo Go the token is returned keyed
  // off the default project, so we only pass it when present.
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return tokenResponse.data;
}

/**
 * POST the token + device metadata to the backend so APNs messages can
 * be fan-routed through to this install. See the module-level backend
 * contract above for the endpoint shape.
 *
 * We fetch directly (rather than going through `api.ts::requestJson`)
 * because:
 *   1. The endpoint doesn't live in `@weavenyc/shared` yet — when the
 *      backend team ships it we'll migrate to a schema-validated path.
 *   2. Register is best-effort: a 4xx / 5xx here should NOT explode the
 *      calling screen. We surface a thrown error so the caller can log /
 *      retry, but the session stays usable.
 */
export async function registerDeviceWithBackend(
  accessToken: string,
  token: string,
  metadata: DeviceMetadata,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/v1/devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      device_id: metadata.deviceId,
      push_token: token,
      platform: 'ios',
      locale: metadata.locale,
    }),
  });

  if (!response.ok) {
    throw new Error(`/v1/devices/register failed: HTTP ${response.status}`);
  }
}

/**
 * Persist the newly-registered push token to the preferences row so the
 * next cold start can detect token rotation. Kept small — the
 * preferences slice deliberately ignores the `pushToken` /
 * `pushTokenRegisteredAt` / `pushPermissionStatus` keys at the reducer
 * level (unknown fields drop on re-hydrate); the MMKV row is the source
 * of truth for token-rotation checks.
 */
export async function updatePersistedPushToken(
  next: PersistedPushRegistration,
): Promise<void> {
  const existing = ((await loadPreferences()) ?? {}) as PreferencesWithPush;
  const merged: PreferencesWithPush = {
    ...existing,
    pushToken: next.pushToken,
    pushTokenRegisteredAt: next.pushTokenRegisteredAt,
    pushPermissionStatus: next.pushPermissionStatus,
  };
  // Cast through `PreferencesState` — `savePreferences` only reads the
  // keys the reducer knows about and writes the full object back via
  // Dexie's `put`. Extra keys survive the round-trip since the kv row
  // is typed as `unknown`.
  await savePreferences(merged as PreferencesState);
}

/**
 * Load the persisted push registration row (if any). Returns `null` when
 * the preferences row doesn't exist or doesn't have a token yet.
 */
export async function loadPersistedPushToken(): Promise<PersistedPushRegistration | null> {
  const raw = (await loadPreferences()) as PreferencesWithPush | null;
  if (!raw?.pushToken || !raw.pushTokenRegisteredAt || !raw.pushPermissionStatus) {
    return null;
  }
  return {
    pushToken: raw.pushToken,
    pushTokenRegisteredAt: raw.pushTokenRegisteredAt,
    pushPermissionStatus: raw.pushPermissionStatus,
  };
}

/**
 * Atomic register-this-device pipeline — requests permission (idempotent
 * if already granted), fetches the Expo token, POSTs to backend, and
 * persists the last-known token. Returns `null` when the user declined
 * or the native module isn't available; the token string on success.
 *
 * The three Network / Storage IO calls fire sequentially so a transient
 * failure at step N doesn't leave stale state at step N-1. Callers are
 * expected to catch and surface any thrown error.
 */
export async function registerForPushNotifications(
  accessToken: string,
  metadata: DeviceMetadata,
): Promise<string | null> {
  const permission = await requestPushPermission();
  if (permission !== 'granted') {
    await updatePersistedPushToken({
      pushToken: '',
      pushTokenRegisteredAt: new Date().toISOString(),
      pushPermissionStatus: permission,
    });
    return null;
  }

  const token = await registerDeviceForPush();
  await registerDeviceWithBackend(accessToken, token, metadata);
  await updatePersistedPushToken({
    pushToken: token,
    pushTokenRegisteredAt: new Date().toISOString(),
    pushPermissionStatus: 'granted',
  });
  return token;
}

/**
 * Configure the three iOS notification categories (CHAT_MESSAGE,
 * CONTACT_REQUEST, POST_MATCH). Called on app mount from `_layout.tsx`
 * — must run BEFORE any notification arrives otherwise the user sees
 * the system default banner without the action buttons.
 *
 * Each category's `identifier` matches the `category` field on the
 * notification payload the backend sends — keep these in sync when the
 * backend adds new notification kinds.
 */
export async function configureNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('CHAT_MESSAGE', [
      {
        identifier: 'REPLY',
        buttonTitle: 'Reply',
        textInput: { submitButtonTitle: 'Send', placeholder: '' },
      },
      {
        identifier: 'MARK_READ',
        buttonTitle: 'Mark read',
      },
    ]);

    await Notifications.setNotificationCategoryAsync('CONTACT_REQUEST', [
      {
        identifier: 'ACCEPT',
        buttonTitle: 'Accept',
      },
      {
        identifier: 'DECLINE',
        buttonTitle: 'Decline',
        options: { isDestructive: true },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('POST_MATCH', [
      {
        identifier: 'VIEW',
        buttonTitle: 'View',
      },
    ]);
  } catch {
    // Native module not linked — this is fine in Expo Go / simulator;
    // the categories only need to exist when a real APNs payload with
    // `category` arrives, which only happens on EAS-built binaries.
    return;
  }
}

/**
 * Tap handler — fires when the user taps a notification (either the
 * body or an action button). Routes to `data.route` when present; this
 * lets the backend steer the tap target purely via the notification
 * payload (e.g. `{ data: { route: "/conversations/abc" } }` jumps into
 * the thread directly).
 *
 * Kept injected (`onNavigate` param) rather than importing `router`
 * directly so the handler is trivially testable against a jest.fn. The
 * `_layout.tsx` registration wires this up with the real expo-router
 * `router.push`.
 */
export function onNotificationResponse(
  response: Notifications.NotificationResponse,
  onNavigate: (route: string) => void,
): void {
  const data = response?.notification?.request?.content?.data as
    | { route?: string }
    | null
    | undefined;
  const route = data && typeof data.route === 'string' ? data.route : null;
  if (route) {
    onNavigate(route);
  }
}

/**
 * Foreground handler — optional in-app toast when a notification
 * arrives while the app is already open. iOS shows the banner natively
 * when `shouldShowAlert: true`, so this is a hook-point for an in-app
 * highlight when the user is deep in a different screen. Returns the
 * parsed `{ title, body, route }` triple for consumers to render.
 */
export function onNotificationReceived(
  notification: Notifications.Notification,
): { title: string; body: string; route: string | null } | null {
  const content = notification?.request?.content;
  if (!content) return null;
  const data = content.data as { route?: string } | null | undefined;
  return {
    title: typeof content.title === 'string' ? content.title : '',
    body: typeof content.body === 'string' ? content.body : '',
    route: data && typeof data.route === 'string' ? data.route : null,
  };
}

/**
 * Called from the settings toggle on OFF — tells expo-notifications to
 * stop surfacing any incoming notifications while the app is
 * foregrounded and persists the disabled state so the bootstrap on next
 * launch doesn't re-register.
 *
 * NOTE: this does NOT revoke the APNs permission (iOS doesn't expose
 * that surface) — it just tells the OS to keep the banner suppressed at
 * the app level. The user has to toggle it back via Settings > WeaveNYC
 * > Notifications on the OS side for the hard off.
 */
export async function disablePushLocally(): Promise<void> {
  try {
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Native module not linked — no-op.
  }
  await updatePersistedPushToken({
    pushToken: '',
    pushTokenRegisteredAt: new Date().toISOString(),
    pushPermissionStatus: 'denied',
  });
}
