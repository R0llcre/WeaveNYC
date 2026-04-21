import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  DefaultPostVisibility,
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
};

function uniqueBookmarks(bookmarks: string[]) {
  return Array.from(new Set(bookmarks.filter(Boolean)));
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: initialPreferencesState,
  reducers: {
    hydratePreferences(_state, action: PayloadAction<Partial<PreferencesState> | null | undefined>) {
      // `hydrationComplete` is derived here (always `true` after hydration
      // runs) regardless of what the persisted payload contains, so the
      // onboarding guard in ResourceHome can rely on this flag instead of
      // a setTimeout race.
      return {
        ...initialPreferencesState,
        ...action.payload,
        bookmarks: uniqueBookmarks(action.payload?.bookmarks ?? []),
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
      state.language = action.payload;
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
  },
});

export const {
  applyDetectedLanguage,
  completeOnboarding,
  dismissTrustBanner,
  hydratePreferences,
  setDefaultPostVisibility,
  setLanguage,
  setLocationPrecision,
  setZipCode,
  toggleBookmark,
  toggleLowBandwidth,
} = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
