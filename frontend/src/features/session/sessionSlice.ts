import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/api';
import type { SignedInUser } from '../../api/types';
import { sessionExpired } from './sessionActions';

export type SessionStatus = 'unknown' | 'signedIn' | 'signedOut';

interface SessionState {
  status: SessionStatus;
  user: SignedInUser | null;
}

const initialState: SessionState = { status: 'unknown', user: null };

const signedOut = (): SessionState => ({ status: 'signedOut', user: null });

/**
 * Who is signed in. "unknown" until the server answers /api/auth/me. The session itself lives in
 * an httpOnly cookie the app can't read, so the server is always the source of truth.
 */
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sessionExpired, signedOut)
      .addMatcher(api.endpoints.getMe.matchFulfilled, (_state, { payload }) => ({
        status: 'signedIn',
        user: payload,
      }))
      .addMatcher(api.endpoints.getMe.matchRejected, (state, action) =>
        // A request skipped because one is already running is not an answer.
        action.meta.condition ? state : signedOut(),
      )
      .addMatcher(api.endpoints.login.matchFulfilled, (_state, { payload }) => ({
        status: 'signedIn',
        user: payload,
      }))
      .addMatcher(api.endpoints.logout.matchFulfilled, signedOut)
      .addMatcher(api.endpoints.logout.matchRejected, signedOut);
  },
});

export const sessionReducer = sessionSlice.reducer;
