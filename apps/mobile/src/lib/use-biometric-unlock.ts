/**
 * Biometric unlock primitives — Phase 3-B.
 *
 * Thin wrapper around `expo-local-authentication` so screens don't need to
 * couple to the native module shape. Two concerns:
 *
 *   1. `useBiometricSupport()` — a hook that inspects the device on mount
 *      and returns whether Face ID / Touch ID hardware is present AND the
 *      user has enrolled a biometric. We split "supported" (hardware) from
 *      "enrolled" (user configured) because the UX differs: hardware
 *      without enrolment should prompt the user to open Settings rather
 *      than disabling the feature entirely.
 *
 *   2. `authenticateBiometric(reason)` — imperative call that kicks the
 *      OS prompt. Returns a plain `boolean` so callers can branch on
 *      success without importing the native result shape. `cancelLabel`
 *      is localised (falls back to "Cancel"). `disableDeviceFallback:
 *      false` keeps the "Use passcode" button on the iOS prompt, which
 *      matches our security model: the Keychain-stored refresh token is
 *      already protected by the device passcode, so a biometric miss
 *      falling through to passcode doesn't weaken anything.
 *
 * Native module is imported lazily inside the functions. Jest / Node
 * environments without the Expo plugin chain can still evaluate this
 * module, which matters for the import smoke test.
 */

import { useEffect, useState } from 'react';

/** Narrow shape we require from `expo-local-authentication`. */
type LocalAuthModule = {
  AuthenticationType?: {
    FINGERPRINT: number;
    FACIAL_RECOGNITION: number;
    IRIS?: number;
  };
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync(): Promise<number[]>;
  authenticateAsync(options: {
    promptMessage: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
  }): Promise<{ success: boolean }>;
};

function getLocalAuth(): LocalAuthModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

export type BiometricKind = 'face' | 'fingerprint' | 'none';

export type BiometricSupport = {
  supported: BiometricKind;
  enrolled: boolean;
};

const INITIAL_SUPPORT: BiometricSupport = {
  supported: 'none',
  enrolled: false,
};

/**
 * Inspect the device for biometric capability. Runs once on mount.
 *
 * Face ID wins over Touch ID when both are reported (iPad Pro with both
 * sensors — we prefer the label the user is more likely to recognise).
 */
export function useBiometricSupport(): BiometricSupport {
  const [support, setSupport] = useState<BiometricSupport>(INITIAL_SUPPORT);

  useEffect(() => {
    let cancelled = false;
    const mod = getLocalAuth();
    if (!mod) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [hasHardware, enrolled, types] = await Promise.all([
          mod.hasHardwareAsync(),
          mod.isEnrolledAsync(),
          mod.supportedAuthenticationTypesAsync(),
        ]);

        if (cancelled) return;

        if (!hasHardware) {
          setSupport({ supported: 'none', enrolled: false });
          return;
        }

        const faceConst = mod.AuthenticationType?.FACIAL_RECOGNITION ?? 2;
        const fingerConst = mod.AuthenticationType?.FINGERPRINT ?? 1;

        let kind: BiometricKind = 'none';
        if (types.includes(faceConst)) {
          kind = 'face';
        } else if (types.includes(fingerConst)) {
          kind = 'fingerprint';
        }

        setSupport({ supported: kind, enrolled });
      } catch {
        if (!cancelled) {
          setSupport(INITIAL_SUPPORT);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return support;
}

/**
 * Trigger the OS biometric prompt. Returns `true` on success, `false` on
 * cancellation, failure, or a missing native module. Never throws — the
 * caller just guards its next step on the boolean.
 */
export async function authenticateBiometric(
  reason: string,
  options: { cancelLabel?: string } = {},
): Promise<boolean> {
  const mod = getLocalAuth();
  if (!mod) return false;
  try {
    const result = await mod.authenticateAsync({
      promptMessage: reason,
      cancelLabel: options.cancelLabel ?? 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success === true;
  } catch {
    return false;
  }
}
