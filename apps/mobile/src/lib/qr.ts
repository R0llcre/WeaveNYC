/**
 * QR helpers — mobile (M2 port of apps/pwa/src/lib/qr.ts).
 *
 * Only the pure parser crosses the PWA → mobile boundary. The scanning
 * call-sites (`scanQrFromImageFile`, `scanQrFromVideo`) rely on the
 * `BarcodeDetector` Web API + `HTMLVideoElement` / `HTMLCanvasElement`,
 * none of which exist in React Native. Mobile scanning is handled by
 * `expo-camera` (or `expo-barcode-scanner`) at the call-site — those
 * native modules surface a callback with the scanned raw string, which
 * the caller then pipes through `parseScannedQrPayload` to get the
 * normalised invite/token shape.
 *
 * The browser-only helpers are intentionally NOT re-exported here so a
 * mobile screen that tries to import them fails at compile time rather
 * than at runtime on an Android device in a subway tunnel.
 */

export function parseScannedQrPayload(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const inviteCode = url.searchParams.get('invite_code');
    const qrToken = url.searchParams.get('qr_token');

    if (inviteCode) {
      return {
        inviteCode,
        qrToken: undefined,
      };
    }

    if (qrToken) {
      return {
        inviteCode: undefined,
        qrToken,
      };
    }
  } catch {
    // Continue with raw token fallback.
  }

  return {
    inviteCode: undefined,
    qrToken: value,
  };
}

// TODO(mobile): the PWA exposes `supportsBarcodeDetector`,
// `scanQrFromImageFile`, and `scanQrFromVideo` here. Those are all
// browser-API-bound (`BarcodeDetector`, `HTMLVideoElement`,
// `createImageBitmap`). On mobile the equivalents live in `expo-camera`
// / `expo-barcode-scanner` and are invoked directly by the screen that
// owns the camera preview — no shared helper needed.
