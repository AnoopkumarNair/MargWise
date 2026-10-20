/**
 * Dependency boundaries from 04 §3.1. CI fails on any violation.
 * `pnpm prove:boundaries` plants a deliberate bad import and asserts this fails.
 * @type {import('dependency-cruiser').IConfiguration}
 */
const pkg = (name) => `^packages/${name}/`;

module.exports = {
  forbidden: [
    {
      name: 'engine-only-contracts',
      comment: 'engine → contracts only (04 §3.1)',
      severity: 'error',
      from: { path: pkg('engine') },
      to: {
        path: '^(apps|pipeline|services|packages)/',
        pathNot: ['^packages/(engine|contracts)/'],
      },
    },
    {
      name: 'sdks-only-contracts',
      comment: 'content-sdk, telemetry-sdk → contracts only (04 §3.1)',
      severity: 'error',
      from: { path: '^packages/(content-sdk|telemetry-sdk)/' },
      to: {
        path: '^(apps|pipeline|services|packages)/',
        pathNot: ['^packages/(contracts)/', '^packages/$1/'],
      },
    },
    {
      name: 'contracts-are-leaf',
      comment: 'contracts depend on nothing in the monorepo',
      severity: 'error',
      from: { path: pkg('contracts') },
      to: { path: '^(apps|pipeline|services|packages)/', pathNot: pkg('contracts') },
    },
    {
      name: 'ui-layers-no-apps-no-engine',
      comment: 'game-kit, ui, i18n → no app imports; no engine maths in UI (04 §3.1)',
      severity: 'error',
      from: { path: '^packages/(game-kit|ui|i18n)/' },
      to: { path: ['^apps/', pkg('engine'), '^pipeline/', '^services/'] },
    },
    {
      name: 'apps-never-import-apps',
      comment: 'apps/* → any package; never another app',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'apps-never-import-services-or-pipeline',
      comment: 'apps talk to services over HTTP only; service keys never reach the client',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: ['^services/', '^pipeline/'] },
    },
    {
      name: 'pipeline-only-contracts',
      comment: 'pipeline → contracts; never apps or game-kit (04 §3.1)',
      severity: 'error',
      from: { path: '^pipeline/' },
      to: { path: ['^apps/', '^services/', '^packages/'], pathNot: pkg('contracts') },
    },
    {
      name: 'services-only-contracts',
      comment: 'edge functions share validation via contracts only',
      severity: 'error',
      from: { path: '^services/' },
      to: { path: ['^apps/', '^pipeline/', '^packages/'], pathNot: pkg('contracts') },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['node_modules', '/dist/', 'vitest?\\.config\\.ts$', 'vite\\.config\\.ts$'] },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    preserveSymlinks: false,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
      extensions: ['.ts', '.tsx', '.js'],
    },
  },
};
