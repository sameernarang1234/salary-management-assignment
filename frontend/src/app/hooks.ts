import { useDispatch, useSelector } from 'react-redux';
import { useGetMeQuery } from '../api/api';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** The session, asking the server who is signed in the first time it is needed. */
export function useSession() {
  const session = useAppSelector((state) => state.session);
  useGetMeQuery(undefined, { skip: session.status !== 'unknown' });
  return session;
}
