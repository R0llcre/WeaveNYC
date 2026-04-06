import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { PreferencesState, SupportedLanguage } from '@/lib/types';

export const initialPreferencesState: PreferencesState = {
  language: 'en',
  zipCode: '',
  onboardingComplete: false,
  lowBandwidth: false,
  bookmarks: [],
};

function uniqueBookmarks(bookmarks: string[]) {
  return Array.from(new Set(bookmarks.filter(Boolean)));
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: initialPreferencesState,
  reducers: {
    hydratePreferences(_state, action: PayloadAction<Partial<PreferencesState> | null | undefined>) {
      return {
        ...initialPreferencesState,
        ...action.payload,
        bookmarks: uniqueBookmarks(action.payload?.bookmarks ?? []),
      };
    },
    setLanguage(state, action: PayloadAction<SupportedLanguage>) {
      state.language = action.payload;
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
    toggleBookmark(state, action: PayloadAction<string>) {
      if (state.bookmarks.includes(action.payload)) {
        state.bookmarks = state.bookmarks.filter((bookmark) => bookmark !== action.payload);
        return;
      }

      state.bookmarks = uniqueBookmarks([...state.bookmarks, action.payload]);
    },
  },
});

export const {
  completeOnboarding,
  hydratePreferences,
  setLanguage,
  setZipCode,
  toggleBookmark,
  toggleLowBandwidth,
} = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
