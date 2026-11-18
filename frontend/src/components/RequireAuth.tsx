import { LinearProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../app/hooks';

/** Shows the page only to the signed-in HR Manager; otherwise sends them to sign in. */
export function RequireAuth() {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'unknown') {
    return <LinearProgress aria-label="Checking your session" />;
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
