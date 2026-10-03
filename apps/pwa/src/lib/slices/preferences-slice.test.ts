import { describe, expect, it } from 'vitest';

import {
  applyDetectedLanguage,
  hydratePreferences,
  initialPreferencesState,
  preferencesReducer,
  setLanguage,
} from './preferences-slice';

describe('preferences language hydration', () => {
  it('keeps an explicit Spanish choice made before IndexedDB hydration finishes', () => {
    const selected = preferencesReducer(initialPreferencesState, setLanguage('es'));
    const hydrated = preferencesReducer(
      selected,
      hydratePreferences({ language: 'en', hasUserChosenLanguage: false, bookmarks: ['saved-id'] }),
    );
    const afterBrowserFallback = preferencesReducer(hydrated, applyDetectedLanguage('en'));

    expect(afterBrowserFallback.language).toBe('es');
    expect(afterBrowserFallback.hasUserChosenLanguage).toBe(true);
    expect(afterBrowserFallback.bookmarks).toEqual(['saved-id']);
    expect(afterBrowserFallback.hydrationComplete).toBe(true);
  });

  it('keeps an explicit English choice even when it matches the initial language', () => {
    const selected = preferencesReducer(initialPreferencesState, setLanguage('en'));
    const hydrated = preferencesReducer(
      selected,
      hydratePreferences({ language: 'zh', hasUserChosenLanguage: true }),
    );

    expect(hydrated.language).toBe('en');
    expect(hydrated.hasUserChosenLanguage).toBe(true);
  });

  it('restores saved choices and applies browser detection only without an explicit choice', () => {
    const restored = preferencesReducer(
      initialPreferencesState,
      hydratePreferences({ language: 'es', hasUserChosenLanguage: true }),
    );
    expect(restored.language).toBe('es');
    expect(preferencesReducer(restored, applyDetectedLanguage('en')).language).toBe('es');

    const newVisitor = preferencesReducer(initialPreferencesState, hydratePreferences(null));
    expect(preferencesReducer(newVisitor, applyDetectedLanguage('zh')).language).toBe('zh');
  });
});
