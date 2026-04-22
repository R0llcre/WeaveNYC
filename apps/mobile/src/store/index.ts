/**
 * Redux store for mobile.
 *
 * SCOPE (M1): scaffold only. The PWA's store composes four slices (auth,
 * community, postDraft, preferences) whose code lives in
 * apps/pwa/src/lib/slices/. Wave B ports those slices to shared once
 * they've been verified to run in both RN and Next.js. Until then, the
 * mobile store mounts a placeholder reducer so `<Provider store={store}>`
 * works and downstream consumers compile.
 *
 * When the real slices arrive, swap the placeholder for the shared
 * bundle — no other file needs to change (the `RootState` type flows
 * automatically).
 */

import { configureStore, createSlice } from '@reduxjs/toolkit';

const placeholderSlice = createSlice({
  name: 'placeholder',
  initialState: { ready: false },
  reducers: {
    markReady: (state) => {
      state.ready = true;
    },
  },
});

export const { markReady } = placeholderSlice.actions;

export const store = configureStore({
  reducer: {
    placeholder: placeholderSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
