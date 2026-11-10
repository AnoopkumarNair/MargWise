import { handleDelete } from '../../../../core/account.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env }) => handleDelete(request, makeDeps(env));
