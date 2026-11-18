import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { api } from './api/api';
import { App } from './App';
import { renderWithProviders } from './test/render';
import { HR_MANAGER, server, unauthenticated } from './test/server';

const invalidCredentials = () =>
  HttpResponse.json(
    { error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' } },
    { status: 401 },
  );

describe('signing in', () => {
  it('sends a signed-out visitor to the sign-in page', async () => {
    server.use(http.get('/api/auth/me', unauthenticated));

    renderWithProviders(<App />, { route: '/employees' });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  });

  it('signs in and returns to the page that was asked for', async () => {
    server.use(
      http.get('/api/auth/me', unauthenticated),
      http.post('/api/auth/login', async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        return body.password === 'Correct-Horse-42'
          ? HttpResponse.json({ user: HR_MANAGER })
          : invalidCredentials();
      }),
    );
    const { user } = renderWithProviders(<App />, { route: '/employees' });

    await user.type(await screen.findByLabelText('Email'), HR_MANAGER.email);
    await user.type(screen.getByLabelText('Password'), 'Correct-Horse-42');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByTestId('page-title')).toHaveTextContent('Employees');
  });

  it('shows the server’s message for a wrong password', async () => {
    server.use(
      http.get('/api/auth/me', unauthenticated),
      http.post('/api/auth/login', invalidCredentials),
    );
    const { user } = renderWithProviders(<App />, { route: '/' });

    await user.type(await screen.findByLabelText('Email'), HR_MANAGER.email);
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });

  it('validates the form without calling the API', async () => {
    let loginCalls = 0;
    server.use(
      http.get('/api/auth/me', unauthenticated),
      http.post('/api/auth/login', () => {
        loginCalls += 1;
        return HttpResponse.json({ user: HR_MANAGER });
      }),
    );
    const { user } = renderWithProviders(<App />, { route: '/' });

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(loginCalls).toBe(0);
  });

  it('sends a signed-in visitor away from the sign-in page', async () => {
    renderWithProviders(<App />, { route: '/login' });

    expect(await screen.findByTestId('page-title')).toHaveTextContent('Pay insights');
  });
});

describe('the signed-in layout', () => {
  it('shows the navigation, the HR Manager and the page title', async () => {
    renderWithProviders(<App />, { route: '/' });

    const navigation = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(navigation).getByRole('link', { name: 'Pay insights' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Employees' })).toBeInTheDocument();
    expect(screen.getByText(HR_MANAGER.email)).toBeInTheDocument();
    expect(screen.getByTestId('page-title')).toHaveTextContent('Pay insights');
  });

  it('signs out and returns to the sign-in page', async () => {
    let signedOut = false;
    server.use(
      http.post('/api/auth/logout', () => {
        signedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderWithProviders(<App />, { route: '/' });

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(signedOut).toBe(true);
  });

  it('sends the HR Manager to sign in again when the session expires', async () => {
    server.use(http.get('/api/meta', unauthenticated));
    const { store } = renderWithProviders(<App />, { route: '/' });
    await screen.findByRole('navigation', { name: 'Main navigation' });

    await store.dispatch(api.endpoints.getMeta.initiate());

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
  });

  it('hides the sidebar behind a menu button on a phone', async () => {
    window.innerWidth = 375;
    const { user } = renderWithProviders(<App />, { route: '/' });

    const menuButton = await screen.findByRole('button', { name: 'Open navigation' });
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();

    await user.click(menuButton);

    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });

  it('redirects an unknown address to the insights page', async () => {
    renderWithProviders(<App />, { route: '/no-such-page' });

    expect(await screen.findByTestId('page-title')).toHaveTextContent('Pay insights');
  });
});
