import { handleExport } from '../../../../core/account.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env }) => handleExport(request, makeDeps(env));
