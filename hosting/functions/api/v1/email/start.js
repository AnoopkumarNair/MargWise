import { handle } from '../../../../core/email_start.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env, waitUntil }) => handle(request, makeDeps(env, typeof waitUntil === 'function' ? { background: fn => waitUntil(Promise.resolve().then(fn).catch(() => {})) } : {}));   // waitUntil: the email goes out after the reply
