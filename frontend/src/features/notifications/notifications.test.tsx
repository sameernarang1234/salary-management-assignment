import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { Notifications } from './Notifications';
import { dismissNotification, notificationsReducer, notify } from './notificationsSlice';

describe('notifications slice', () => {
  it('starts with no notification', () => {
    expect(notificationsReducer(undefined, { type: 'init' })).toEqual({ current: null });
  });

  it('shows the latest notification and dismisses it', () => {
    const shown = notificationsReducer(
      undefined,
      notify({ message: 'Saved', severity: 'success' }),
    );

    expect(shown.current).toMatchObject({ message: 'Saved', severity: 'success' });
    expect(notificationsReducer(shown, dismissNotification()).current).toBeNull();
  });
});

describe('<Notifications />', () => {
  it('displays a notification dispatched anywhere in the app', async () => {
    const { store } = renderWithProviders(<Notifications />);

    act(() => {
      store.dispatch(notify({ message: 'Salary updated', severity: 'success' }));
    });

    expect(await screen.findByText('Salary updated')).toBeInTheDocument();
  });
});
