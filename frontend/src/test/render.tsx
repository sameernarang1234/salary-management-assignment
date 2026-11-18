import { CssBaseline, ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { makeStore, type AppStore } from '../app/store';
import { theme } from '../theme';

/** Renders with a fresh Redux store, the theme and a router starting at `route`. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', store = makeStore() }: { route?: string; store?: AppStore } = {},
) {
  return {
    store,
    // No pause between keystrokes: same events, much faster on slow machines.
    user: userEvent.setup({ delay: null }),
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </ThemeProvider>
      </Provider>,
    ),
  };
}
