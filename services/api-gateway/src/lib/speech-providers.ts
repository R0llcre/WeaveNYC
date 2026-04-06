import type { SupportedLanguage } from '@weavenyc/shared';

export interface SpeechProvider {
  transcribe(input: {
    audio: Buffer;
    filename?: string;
    mimeType?: string;
    languageHint?: SupportedLanguage;
    transcriptHint?: string;
  }): Promise<{
    transcript: string;
    language: SupportedLanguage;
    provider: 'server_fallback';
  }>;
  close?(): Promise<void>;
}

function decodeTranscriptHint(buffer: Buffer) {
  const text = buffer.toString('utf8').trim();
  if (!text) {
    return null;
  }

  const printableChars = Array.from(text).filter((char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    return (
      codePoint === 0x09 ||
      codePoint === 0x0a ||
      codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0x7e) ||
      (codePoint >= 0x00a0 && codePoint <= 0x024f) ||
      (codePoint >= 0x4e00 && codePoint <= 0x9fff)
    );
  }).length;
  const printableRatio = printableChars / text.length;
  return printableRatio >= 0.85 ? text : null;
}

class StubSpeechProvider implements SpeechProvider {
  async transcribe(input: {
    audio: Buffer;
    languageHint?: SupportedLanguage;
    transcriptHint?: string;
  }) {
    const hinted = input.transcriptHint?.trim();
    const transcript =
      hinted ||
      decodeTranscriptHint(input.audio) ||
      'Voice note received. A server fallback transcript is not available in demo mode.';

    return {
      transcript,
      language: input.languageHint ?? 'en',
      provider: 'server_fallback' as const,
    };
  }

  async close() {}
}

export function createStubSpeechProvider() {
  return new StubSpeechProvider();
}
