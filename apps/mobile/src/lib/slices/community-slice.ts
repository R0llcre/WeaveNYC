import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { CommunityJoinPreview, CommunityState, JoinedCommunity } from '@/lib/types';

export const initialCommunityState: CommunityState = {
  currentCommunityId: null,
  joinedCommunities: [],
  joinPreview: null,
};

function uniqueCommunities(joinedCommunities: JoinedCommunity[]) {
  const byId = new Map<string, JoinedCommunity>();
  for (const community of joinedCommunities) {
    byId.set(community.community.community_id, community);
  }

  return Array.from(byId.values());
}

const communitySlice = createSlice({
  name: 'community',
  initialState: initialCommunityState,
  reducers: {
    hydrateCommunity(_state, action: PayloadAction<Partial<CommunityState> | null | undefined>) {
      return {
        ...initialCommunityState,
        ...action.payload,
        joinedCommunities: uniqueCommunities(action.payload?.joinedCommunities ?? []),
      };
    },
    setJoinPreview(state, action: PayloadAction<CommunityJoinPreview>) {
      state.joinPreview = action.payload;
    },
    clearJoinPreview(state) {
      state.joinPreview = null;
    },
    upsertJoinedCommunity(state, action: PayloadAction<JoinedCommunity>) {
      state.joinedCommunities = uniqueCommunities([...state.joinedCommunities, action.payload]);
      state.currentCommunityId = action.payload.community.community_id;
      state.joinPreview = null;
    },
    setCurrentCommunity(state, action: PayloadAction<string | null>) {
      state.currentCommunityId = action.payload;
    },
  },
});

export const {
  clearJoinPreview,
  hydrateCommunity,
  setCurrentCommunity,
  setJoinPreview,
  upsertJoinedCommunity,
} = communitySlice.actions;
export const communityReducer = communitySlice.reducer;
