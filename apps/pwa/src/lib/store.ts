import { configureStore } from '@reduxjs/toolkit';

import { authReducer } from '@/lib/slices/auth-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    preferences: preferencesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
