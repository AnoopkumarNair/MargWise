import { defineProject, type UserWorkspaceConfig } from 'vitest/config';

/**
 * Shared Vitest project defaults. Every package uses this so test discovery,
 * environment and timeouts stay uniform across the monorepo.
 */
export function margwiseProject(
  name: string,
  overrides: UserWorkspaceConfig['test'] = {},
): UserWorkspaceConfig {
  return defineProject({
    test: {
      name,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
      environment: 'node',
      ...overrides,
    },
  });
}
