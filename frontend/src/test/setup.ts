import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { server } from './server';

// findBy/waitFor wait up to 5 s (default 1 s): MUI pages render slowly in jsdom.
configure({ asyncUtilTimeout: 5_000 });

/**
 * jsdom has no matchMedia, so MUI's useMediaQuery would always report a phone. This evaluates
 * min-width / max-width queries against window.innerWidth (desktop by default; tests can set
 * window.innerWidth to check the phone layout).
 */
function matches(query: string): boolean {
  const width = window.innerWidth;
  const min = /min-width:\s*([\d.]+)px/.exec(query);
  const max = /max-width:\s*([\d.]+)px/.exec(query);
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
}

beforeEach(() => {
  window.innerWidth = 1280;
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    get matches() {
      return matches(query);
    },
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// Mock the API at the network boundary: unhandled requests fail the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
