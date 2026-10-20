import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config: one project per workspace package, one coverage report.
 * Thresholds are per directory so the pure core (contracts, engine, SDKs) is
 * held to a higher bar than UI shells. Raise them, never lower them.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
      'pipeline/vitest.config.ts',
      'services/supabase/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
      include: [
        'packages/*/src/**/*.{ts,tsx}',
        'apps/*/src/**/*.{ts,tsx}',
        'pipeline/src/**/*.ts',
        'services/supabase/functions/_lib/**/*.ts',
      ],
      exclude: ['**/*.test.{ts,tsx}', '**/main.tsx', '**/fixtures/**'],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
        'packages/contracts/src/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        'packages/content-sdk/src/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        'packages/telemetry-sdk/src/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        'services/supabase/functions/_lib/**': {
          lines: 95,
          branches: 90,
          functions: 95,
          statements: 95,
        },
      },
    },
  },
});
