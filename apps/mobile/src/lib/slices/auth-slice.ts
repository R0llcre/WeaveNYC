import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthSession } from '@/lib/types';

type AuthState = {
  session: AuthSession | null;
};

const initialState: AuthState = {
  session: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hydrateSession(state, action: PayloadAction<AuthSession | null | undefined>) {
      state.session = action.payload ?? null;
    },
    setSession(state, action: PayloadAction<AuthSession>) {
      state.session = action.payload;
    },
    clearSession(state) {
      state.session = null;
    },
  },
});

export const { clearSession, hydrateSession, setSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
