import { configureStore } from '@reduxjs/toolkit';
import { api } from '../api/api';
import { notificationsReducer } from '../features/notifications/notificationsSlice';
import { sessionReducer } from '../features/session/sessionSlice';

/** A new store per app (and per test), so tests never share state. */
export function makeStore() {
  return configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      session: sessionReducer,
      notifications: notificationsReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
