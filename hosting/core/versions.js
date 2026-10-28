// The version numbers the server reports (health, logs). They come from contracts/versions.json, the one place they are set.
import versions from '../../contracts/versions.json' with { type: 'json' };
export { versions };
