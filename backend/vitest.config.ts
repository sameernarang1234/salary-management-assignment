import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    // Test files share one PostgreSQL test database and empty it between tests,
    // so they run one after another rather than in parallel.
    fileParallelism: false,
  },
});
