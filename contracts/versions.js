// Contract versions (BACKEND ADR-07), the one place they are set for JavaScript. contracts/versions.json holds the same
// numbers for readers that are not JavaScript (Python, people), and a test keeps the two equal.
// A plain module rather than a JSON import, so any bundler (including older wrangler builds) can load it.
// Bump the matching number in the same commit as any change: matcher behaviour -> MATCHER_VERSION; profile.schema.json or a band
// the profile uses -> PROFILE_V (and add a step to profile_migrations.js); slice.schema.json or skills_index.schema.json -> SLICE_V;
// api/*, events.schema.json, extract.schema.json or event_schemas.js -> API_V.
// Frozen at the end of S0 (contracts/FROZEN.md): contracts/tests/freeze.test.mjs fails when a contract file changes without its version.
// PROFILE_V and API_V stay 1 through the S0 owner decisions D1 to D6, because no version was released before the freeze (deviations.md).
export const versions = Object.freeze({
  MATCHER_VERSION: '1.0.0',
  PROFILE_V: 1,
  SLICE_V: 1,
  API_V: 1,
});
