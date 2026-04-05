import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AnonymousSessionResponse } from '@/lib/types';

type AuthState = {
  session: AnonymousSessionResponse | null;
};

const initialState: AuthState = {
  session: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<AnonymousSessionResponse>) {
      state.session = action.payload;
    },
    clearSession(state) {
      state.session = null;
    },
  },
});

export const { clearSession, setSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
