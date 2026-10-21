import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-types/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      // Deno entrypoints are checked by `deno check` in CI, not by Node tooling.
      'services/supabase/functions/*/index.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Rule 7 (RULES.md): engines are pure. No I/O, no clocks, no randomness
    // except an injected seeded PRNG.
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Engines are pure: no network.' },
        { name: 'localStorage', message: 'Engines are pure: no storage.' },
        { name: 'indexedDB', message: 'Engines are pure: no storage.' },
        { name: 'window', message: 'Engines are pure: no DOM.' },
        { name: 'document', message: 'Engines are pure: no DOM.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the injected seeded PRNG.' },
        { object: 'Date', property: 'now', message: 'Pass time in as an argument.' },
      ],
    },
  },
  {
    // Rule 1 (RULES.md): no facts in code. The UI must not do engine maths.
    files: ['packages/ui/src/**/*.{ts,tsx}', 'packages/game-kit/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@margwise/engine', '@margwise/engine/*'],
              message: 'UI does no maths; receive engine outputs via props.',
            },
          ],
        },
      ],
    },
  },
);
