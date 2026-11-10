// admin.js does `import CLAIMS from './_claims.json'` (the bundler allows it; Node 22 wants `with { type: 'json' }`). Registering this hook before
// importing it lets the tests load the unchanged student file. Import this module first, then import admin.js dynamically.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function load(url, context, next) {
  if (url.endsWith('.json') && !(context.importAttributes && context.importAttributes.type)) return next(url, { ...context, importAttributes: { type: 'json' } });
  return next(url, context);
}`));
