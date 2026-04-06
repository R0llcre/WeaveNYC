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

export function supportsBarcodeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

type BarcodeDetectorWindow = Window &
  typeof globalThis & {
    BarcodeDetector: new (input: { formats: string[] }) => {
      detect(bitmap: ImageBitmap): Promise<Array<{ rawValue?: string }>>;
    };
  };

function getBarcodeDetectorConstructor() {
  return (window as unknown as BarcodeDetectorWindow).BarcodeDetector;
}

export async function scanQrFromImageFile(file: File) {
  if (!supportsBarcodeDetector()) {
    throw new Error('QR scanning is not supported in this browser.');
  }

  const BarcodeDetectorConstructor = getBarcodeDetectorConstructor();
  const detector = new BarcodeDetectorConstructor({ formats: ['qr_code'] });
  const imageBitmap = await createImageBitmap(file);
  const codes = await detector.detect(imageBitmap);
  const raw = codes[0]?.rawValue?.trim();
  if (!raw) {
    throw new Error('No QR code was detected in the uploaded image.');
  }

  return raw;
}

export async function scanQrFromVideo(video: HTMLVideoElement) {
  if (!supportsBarcodeDetector()) {
    throw new Error('QR scanning is not supported in this browser.');
  }

  const BarcodeDetectorConstructor = getBarcodeDetectorConstructor();
  const detector = new BarcodeDetectorConstructor({ formats: ['qr_code'] });
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to access a canvas context for QR scanning.');
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const bitmap = await createImageBitmap(canvas);
  const codes = await detector.detect(bitmap);
  const raw = codes[0]?.rawValue?.trim();
  if (!raw) {
    throw new Error('No QR code was detected in the current camera frame.');
  }

  return raw;
}
