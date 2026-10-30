import { handle } from '../../../core/health.js';
import { makeDeps } from '../../../core/deps.js';
export const onRequestGet = ({ request, env }) => handle(request, makeDeps(env));
