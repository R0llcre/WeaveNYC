import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  DefaultPostVisibility,
  HomeIntent,
  LocationPrecision,
  PreferencesState,
  SupportedLanguage,
} from '@/lib/types';

export const initialPreferencesState: PreferencesState = {
  language: 'en',
  zipCode: '',
  onboardingComplete: false,
  lowBandwidth: false,
  bookmarks: [],
  defaultPostVisibility: 'community_only',
  locationPrecision: 'zip_only',
  hasUserChosenLanguage: false,
  trustBannerDismissed: false,
  hydrationComplete: false,
  lastIntent: null,
};

function uniqueBookmarks(bookmarks: string[]) {
  return Array.from(new Set(bookmarks.filter(Boolean)));
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: initialPreferencesState,
  reducers: {
    hydratePreferences(state, action: PayloadAction<Partial<PreferencesState> | null | undefined>) {
      // A language choice made while IndexedDB is still loading is newer
      // than the stored/browser fallback. Keep it when hydration completes.
      // This can happen on the first language picker or a fast settings tap.
      const pendingLanguageChoice = !state.hydrationComplete && state.hasUserChosenLanguage;
      return {
        ...initialPreferencesState,
        ...action.payload,
        bookmarks: uniqueBookmarks(action.payload?.bookmarks ?? []),
        ...(pendingLanguageChoice
          ? { language: state.language, hasUserChosenLanguage: true }
          : {}),
        hydrationComplete: true,
      };
    },
    setLanguage(state, action: PayloadAction<SupportedLanguage>) {
      state.language = action.payload;
      // Any explicit setLanguage dispatch (language picker or settings)
      // counts as a user choice and locks out the browser-locale fallback.
      state.hasUserChosenLanguage = true;
    },
    setZipCode(state, action: PayloadAction<string>) {
      state.zipCode = action.payload;
    },
    completeOnboarding(state) {
      state.onboardingComplete = true;
    },
    toggleLowBandwidth(state) {
      state.lowBandwidth = !state.lowBandwidth;
    },
    setDefaultPostVisibility(state, action: PayloadAction<DefaultPostVisibility>) {
      state.defaultPostVisibility = action.payload;
    },
    setLocationPrecision(state, action: PayloadAction<LocationPrecision>) {
      state.locationPrecision = action.payload;
    },
    toggleBookmark(state, action: PayloadAction<string>) {
      if (state.bookmarks.includes(action.payload)) {
        state.bookmarks = state.bookmarks.filter((bookmark) => bookmark !== action.payload);
        return;
      }

      state.bookmarks = uniqueBookmarks([...state.bookmarks, action.payload]);
    },
    /**
     * Apply a browser-detected language fallback. Unlike `setLanguage`,
     * this does NOT flip `hasUserChosenLanguage`, so the user can still
     * make an explicit choice on the language picker that overrides the
     * detected locale.
     */
    applyDetectedLanguage(state, action: PayloadAction<SupportedLanguage>) {
      // The browser fallback may arrive after a user taps the picker.
      if (!state.hasUserChosenLanguage) {
        state.language = action.payload;
      }
    },
    /**
     * V1-B Task 4 — persist the "user dismissed the first-visit trust
     * banner" flag. Idempotent: calling twice is a no-op. We never flip
     * it back to `false`; the banner is a one-time welcome, not a
     * recurring reminder.
     */
    dismissTrustBanner(state) {
      state.trustBannerDismissed = true;
    },
    /**
     * V2-D — record which crisis-first intent the user picked on the Home
     * wizard. `<page.tsx>` reads `preferences.lastIntent` to decide between
     * rendering `<HomeWizard />` (null) and `<ResourceDirectory />` (any
     * intent). Persisted to IndexedDB so a returning user lands on the
     * same pre-filtered directory they picked last time.
     */
    setLastIntent(state, action: PayloadAction<HomeIntent>) {
      state.lastIntent = action.payload;
    },
    /**
     * V2-D — reset the Home wizard pick so the next visit to `/` re-renders
     * the 4-card intent picker. Dispatched by the "Change what I'm looking
     * for" ghost button on the pre-filtered directory.
     */
    clearLastIntent(state) {
      state.lastIntent = null;
    },
  },
});

export const {
  applyDetectedLanguage,
  clearLastIntent,
  completeOnboarding,
  dismissTrustBanner,
  hydratePreferences,
  setDefaultPostVisibility,
  setLanguage,
  setLastIntent,
  setLocationPrecision,
  setZipCode,
  toggleBookmark,
  toggleLowBandwidth,
} = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
