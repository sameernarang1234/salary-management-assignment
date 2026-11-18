import { Alert, Snackbar } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { dismissNotification } from './notificationsSlice';

export function Notifications() {
  const notification = useAppSelector((state) => state.notifications.current);
  const dispatch = useAppDispatch();
  const close = () => dispatch(dismissNotification());

  return (
    <Snackbar
      key={notification?.id}
      open={notification !== null}
      autoHideDuration={6000}
      onClose={(_event, reason) => reason !== 'clickaway' && close()}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {notification ? (
        <Alert severity={notification.severity} variant="filled" onClose={close}>
          {notification.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
