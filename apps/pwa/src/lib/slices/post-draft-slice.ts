import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { PostCategory, PostDraftState, PostDraftStep, PostPrivacy, PostType, SupportedLanguage } from '@/lib/types';

function defaultExpiresAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

export const initialPostDraftState: PostDraftState = {
  step: 'type',
  postType: null,
  category: 'food',
  title: '',
  body: '',
  language: 'en',
  locationZip: '',
  privacy: 'community_only',
  expiresAt: defaultExpiresAt(),
  contactPref: {
    inAppChat: true,
    call: false,
    text: false,
    notes: '',
  },
};

type MergeDraftPayload = Partial<{
  step: PostDraftStep;
  postType: PostType | null;
  category: PostCategory;
  title: string;
  body: string;
  language: SupportedLanguage;
  locationZip: string;
  privacy: PostPrivacy;
  expiresAt: string;
  contactPref: PostDraftState['contactPref'];
}>;

const postDraftSlice = createSlice({
  name: 'postDraft',
  initialState: initialPostDraftState,
  reducers: {
    hydratePostDraft(_state, action: PayloadAction<Partial<PostDraftState> | null | undefined>) {
      return {
        ...initialPostDraftState,
        ...action.payload,
        contactPref: {
          ...initialPostDraftState.contactPref,
          ...action.payload?.contactPref,
        },
      };
    },
    mergePostDraft(state, action: PayloadAction<MergeDraftPayload>) {
      Object.assign(state, action.payload);
      if (action.payload.contactPref) {
        state.contactPref = {
          ...state.contactPref,
          ...action.payload.contactPref,
        };
      }
    },
    setDraftStep(state, action: PayloadAction<PostDraftStep>) {
      state.step = action.payload;
    },
    resetPostDraft() {
      return {
        ...initialPostDraftState,
        expiresAt: defaultExpiresAt(),
      };
    },
  },
});

export const { hydratePostDraft, mergePostDraft, resetPostDraft, setDraftStep } = postDraftSlice.actions;
export const postDraftReducer = postDraftSlice.reducer;
