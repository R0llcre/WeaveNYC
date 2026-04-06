import type { SupportedLanguage } from '@/lib/types';

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  start(): void;
  stop(): void;
};

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).SpeechRecognition ??
    (window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }).webkitSpeechRecognition ??
    null;
}

export function supportsBrowserSpeechRecognition() {
  return Boolean(getSpeechRecognitionConstructor());
}

export async function listenOnceWithBrowserSpeech(language: SupportedLanguage) {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) {
    throw new Error('Browser speech recognition is not available.');
  }

  return new Promise<string>((resolve, reject) => {
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;
    recognition.onerror = (event) => {
      reject(new Error(event.error || 'Browser speech recognition failed.'));
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .flatMap((result) => Array.from(result))
        .map((alternative) => alternative.transcript)
        .join(' ')
        .trim();

      if (!transcript) {
        reject(new Error('No speech was detected.'));
        return;
      }

      resolve(transcript);
    };
    recognition.start();
  });
}
