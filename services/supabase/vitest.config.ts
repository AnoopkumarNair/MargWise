import { margwiseProject } from '@margwise/config/vitest';

export default margwiseProject('supabase', { include: ['functions/_lib/**/*.test.ts'] });
