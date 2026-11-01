import { handleGet, handlePut } from '../../../../core/profile.js';
import { makeDeps } from '../../../../core/deps.js';
export const onRequest = ({ request, env }) => (request.method === 'GET' ? handleGet : handlePut)(request, makeDeps(env));
