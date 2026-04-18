import { describe, expect, it } from 'vitest';

import { messages, supportedLanguages } from './i18n';

describe('chrome i18n messages', () => {
  const englishKeys = Object.keys(messages.en).sort();

  it('exposes the expected set of supported languages', () => {
    expect(supportedLanguages).toEqual(['en', 'es', 'zh']);
  });

  it('keeps spanish keys in sync with english', () => {
    expect(Object.keys(messages.es).sort()).toEqual(englishKeys);
  });

  it('keeps chinese keys in sync with english', () => {
    expect(Object.keys(messages.zh).sort()).toEqual(englishKeys);
  });

  it('has no empty translations in any supported language', () => {
    for (const language of supportedLanguages) {
      for (const [key, value] of Object.entries(messages[language])) {
        expect(typeof value, `${language}.${key} must be a string`).toBe('string');
        expect(value.length, `${language}.${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('uses only {placeholder} style interpolation (no HTML or template tags)', () => {
    const forbiddenPatterns = [/<\//, /<[a-zA-Z][^>]*>/, /\{\{/, /\}\}/, /%\(/];
    for (const language of supportedLanguages) {
      for (const [key, value] of Object.entries(messages[language])) {
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(value),
            `${language}.${key} must not contain pattern ${pattern}; got: ${value}`,
          ).toBe(false);
        }
      }
    }
  });

  it('keeps interpolation placeholders consistent across all three languages', () => {
    const placeholderRegex = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
    const extract = (value: string) => {
      const names = new Set<string>();
      for (const match of value.matchAll(placeholderRegex)) {
        names.add(match[1]);
      }
      return Array.from(names).sort();
    };

    for (const key of englishKeys) {
      const enPlaceholders = extract(messages.en[key as keyof typeof messages.en]);
      const esPlaceholders = extract(messages.es[key as keyof typeof messages.es]);
      const zhPlaceholders = extract(messages.zh[key as keyof typeof messages.zh]);
      expect(esPlaceholders, `es.${key} placeholders must match en`).toEqual(enPlaceholders);
      expect(zhPlaceholders, `zh.${key} placeholders must match en`).toEqual(enPlaceholders);
    }
  });
});
