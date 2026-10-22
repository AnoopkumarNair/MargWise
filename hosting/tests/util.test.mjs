import { sign } from '../functions/api/_util.js';
for (const k of [undefined,'','missing','short']) { try { await sign('x',k); console.log('BAD accepted',k) } catch(e){ console.log('rejects',JSON.stringify(k)) } }
console.log('valid ok', (await sign('x','0123456789abcdef0123456789abcdef')).length);
