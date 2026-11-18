import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { notify } from '../features/notifications/notificationsSlice';
import { sessionExpired } from '../features/session/sessionActions';
import type { Credentials, Meta, SignedInUser } from './types';

const rawBaseQuery = fetchBaseQuery({
  // Absolute so the same code works in the browser and in tests; same origin as the app.
  baseUrl: new URL('/api/', window.location.origin).toString(),
  credentials: 'same-origin',
});

/** Endpoints where a 401 is an expected answer, not an expired session. */
const SESSION_ENDPOINTS = new Set(['getMe', 'login', 'logout']);

/** Any other 401 means the session has expired: sign out and tell the HR Manager why. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  apiContext,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, apiContext, extraOptions);
  if (result.error?.status === 401 && !SESSION_ENDPOINTS.has(apiContext.endpoint)) {
    apiContext.dispatch(sessionExpired());
    apiContext.dispatch(
      notify({ message: 'Your session has expired. Please sign in again.', severity: 'warning' }),
    );
  }
  return result;
};

/** All server data goes through this one RTK Query API slice. */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Meta'],
  endpoints: (build) => ({
    getMe: build.query<SignedInUser, void>({
      query: () => 'auth/me',
      transformResponse: (response: { user: SignedInUser }) => response.user,
    }),
    login: build.mutation<SignedInUser, Credentials>({
      query: (credentials) => ({ url: 'auth/login', method: 'POST', body: credentials }),
      transformResponse: (response: { user: SignedInUser }) => response.user,
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
    }),
    getMeta: build.query<Meta, void>({
      query: () => 'meta',
      providesTags: ['Meta'],
    }),
  }),
});

export const { useGetMeQuery, useLoginMutation, useLogoutMutation, useGetMetaQuery } = api;
