import { MMKV } from 'react-native-mmkv';

import type { MatchContactIntent } from '@/lib/types';

const MATCH_CONTACT_INTENT_KEY = 'weavenyc.match-contact-intent';

/**
 * M2 port note — the PWA backs the match-contact intent with
 * `window.sessionStorage` so the value only lives for the current tab
 * session. React Native has no per-session key-value equivalent; MMKV
 * is persistent. That's actually closer to the desired UX on mobile
 * (the user may background the app mid-accept and come back to it),
 * but the intent still MUST be cleared on `clearMatchContactIntent()`
 * so a stale value can't haunt the user across unrelated launches. We
 * use a dedicated MMKV instance (`match-intent-storage`) so a
 * namespace-level `.clearAll()` later could wipe only this key space
 * without touching preferences / session cache.
 *
 * See `STORAGE.md` for the full web-storage → MMKV mapping.
 */
let cachedStorage: MMKV | null = null;
function getStorage(): MMKV | null {
  if (cachedStorage) {
    return cachedStorage;
  }
  try {
    cachedStorage = new MMKV({ id: 'match-intent-storage' });
    return cachedStorage;
  } catch {
    // MMKV falls back to a JSI-bound native module, which isn't
    // installed in the jest `node` preset. Returning null keeps this
    // module import-safe under jest; the caller branches on null
    // exactly like the PWA's `canUseSessionStorage` guard.
    return null;
  }
}

export function loadMatchContactIntent(): MatchContactIntent | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getString(MATCH_CONTACT_INTENT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<MatchContactIntent>;
    if (
      parsed.kind !== 'match_contact' ||
      !parsed.fromPostId ||
      !parsed.toPostId ||
      !parsed.returnTo ||
      !parsed.createdAt ||
      !parsed.targetTitle
    ) {
      return null;
    }

    return {
      kind: 'match_contact',
      fromPostId: parsed.fromPostId,
      toPostId: parsed.toPostId,
      returnTo: parsed.returnTo,
      createdAt: parsed.createdAt,
      targetTitle: parsed.targetTitle,
    };
  } catch {
    return null;
  }
}

export function saveMatchContactIntent(intent: MatchContactIntent) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.set(MATCH_CONTACT_INTENT_KEY, JSON.stringify(intent));
  } catch {
    return;
  }
}

export function clearMatchContactIntent() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.delete(MATCH_CONTACT_INTENT_KEY);
  } catch {
    return;
  }
}
