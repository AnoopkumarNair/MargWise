import { handle } from '../../../../core/email_verify.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env }) => handle(request, makeDeps(env));
