import type { RootState } from '@/lib/store';

/**
 * Shared Redux selectors.
 *
 * Rationale: inlining `useAppSelector((s) => s.something)` in every screen
 * re-implements the same access pattern over and over. When the shape of a
 * slice changes (e.g., renaming `preferences.zipCode` or adding a join-preview
 * flag), each inline selector is a separate migration point. Centralising
 * them here keeps the contract between components and the store in one place
 * and lets us memoise later if a derived shape becomes expensive.
 *
 * Convention:
 *   - `selectX` returns a single slice value
 *   - `selectIsX` returns a boolean predicate derived from one or more slices
 */

export const selectSession = (state: RootState) => state.auth.session;

export const selectIsVerified = (state: RootState) => {
  const level = state.auth.session?.user.level;
  return level === 'verified' || level === 'anchor';
};

export const selectPreferences = (state: RootState) => state.preferences;
export const selectPreferencesLanguage = (state: RootState) => state.preferences.language;
export const selectPreferencesZipCode = (state: RootState) => state.preferences.zipCode;
export const selectPreferencesBookmarks = (state: RootState) => state.preferences.bookmarks;

export const selectCommunity = (state: RootState) => state.community;
export const selectCurrentCommunityId = (state: RootState) =>
  state.community.currentCommunityId;
export const selectJoinedCommunities = (state: RootState) =>
  state.community.joinedCommunities;
export const selectJoinPreview = (state: RootState) => state.community.joinPreview;

export const selectPostDraft = (state: RootState) => state.postDraft;
