/**
 * Tests for `use-biometric-unlock.ts`.
 *
 * We mock `expo-local-authentication` inline so each test can vary the
 * reported hardware / enrolment / auth-result without re-jigging the
 * module registry. The hook path calls `renderHook` from RNTL so we get
 * an act()-wrapped render + a waitFor() to await the useEffect tick.
 *
 * Three cases:
 *   1. Face ID hardware present + enrolled → `supported === 'face'` and
 *      `enrolled === true`.
 *   2. No hardware → `supported === 'none'` (guards the Me-hub toggle
 *      and the inbox/danger gates from surfacing on unsupported devices).
 *   3. `authenticateBiometric` resolves `true` when the native prompt
 *      reports success. Covers the imperative path used by the inbox and
 *      the danger-zone screen.
 */

import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const LocalAuth = jest.requireMock('expo-local-authentication') as {
  hasHardwareAsync: jest.Mock;
  isEnrolledAsync: jest.Mock;
  supportedAuthenticationTypesAsync: jest.Mock;
  authenticateAsync: jest.Mock;
};

import {
  authenticateBiometric,
  useBiometricSupport,
} from '../use-biometric-unlock';

beforeEach(() => {
  LocalAuth.hasHardwareAsync.mockReset();
  LocalAuth.isEnrolledAsync.mockReset();
  LocalAuth.supportedAuthenticationTypesAsync.mockReset();
  LocalAuth.authenticateAsync.mockReset();
});

describe('useBiometricSupport', () => {
  it("returns 'face' when Face ID hardware + an enrolled biometric", async () => {
    LocalAuth.hasHardwareAsync.mockResolvedValue(true);
    LocalAuth.isEnrolledAsync.mockResolvedValue(true);
    LocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([2]);

    const { result } = renderHook(() => useBiometricSupport());

    await waitFor(() => {
      expect(result.current.supported).toBe('face');
    });
    expect(result.current.enrolled).toBe(true);
  });

  it("returns 'none' when the device has no biometric hardware", async () => {
    LocalAuth.hasHardwareAsync.mockResolvedValue(false);
    LocalAuth.isEnrolledAsync.mockResolvedValue(false);
    LocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([]);

    const { result } = renderHook(() => useBiometricSupport());

    await waitFor(() => {
      expect(LocalAuth.hasHardwareAsync).toHaveBeenCalled();
    });
    expect(result.current.supported).toBe('none');
    expect(result.current.enrolled).toBe(false);
  });
});

describe('authenticateBiometric', () => {
  it('resolves true when the native prompt reports success', async () => {
    LocalAuth.authenticateAsync.mockResolvedValue({ success: true });

    const ok = await authenticateBiometric('Unlock to see your messages', {
      cancelLabel: 'Cancel',
    });

    expect(ok).toBe(true);
    expect(LocalAuth.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Unlock to see your messages',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      }),
    );
  });
});
