import { handleLogoutAll } from '../../../../core/account.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env }) => handleLogoutAll(request, makeDeps(env));
