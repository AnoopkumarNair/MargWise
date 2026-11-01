import { handle } from '../../../../core/metrics.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env }) => handle(request, makeDeps(env));
