import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

interface NotificationsState {
  current: Notification | null;
}

const initialState: NotificationsState = { current: null };

/** App-wide messages ("Salary updated"), shown by <Notifications /> wherever they come from. */
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    notify: {
      reducer(state, action: PayloadAction<Notification>) {
        state.current = action.payload;
      },
      prepare(notification: Omit<Notification, 'id'>) {
        return { payload: { ...notification, id: nanoid() } };
      },
    },
    dismissNotification(state) {
      state.current = null;
    },
  },
});

export const { notify, dismissNotification } = notificationsSlice.actions;
export const notificationsReducer = notificationsSlice.reducer;
