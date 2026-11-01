import { handle } from '../../../../core/email_start.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env }) => handle(request, makeDeps(env));
