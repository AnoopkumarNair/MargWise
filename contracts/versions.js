// Contract versions (BACKEND ADR-07), the one place they are set for JavaScript. contracts/versions.json holds the same
// numbers for readers that are not JavaScript (Python, people), and a test keeps the two equal.
// A plain module rather than a JSON import, so any bundler (including older wrangler builds) can load it.
// Bump the matching number in the same commit as any change: matcher behaviour -> MATCHER_VERSION; profile.schema.json or a band
// the profile uses -> PROFILE_V (and add a step to profile_migrations.js); slice.schema.json or skills_index.schema.json -> SLICE_V;
// api/*, events.schema.json or extract.schema.json -> API_V.
export const versions = Object.freeze({
  MATCHER_VERSION: '1.0.0',
  PROFILE_V: 1,
  SLICE_V: 1,
  API_V: 1,
});
