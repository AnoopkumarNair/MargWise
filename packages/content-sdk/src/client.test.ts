import { beforeEach, describe, expect, it } from 'vitest';
import {
  createContentClient,
  ContentIntegrityError,
  ContentUnavailableError,
  MemoryContentCache,
} from './index.ts';
import {
  buildFixtureRelease,
  fixtureFetch,
  RELEASE_ID,
  type FixtureRelease,
} from './fixtures/release.ts';

const BASE = 'https://cdn.example.test/';

describe('content-sdk', () => {
  let release: FixtureRelease;
  let net: ReturnType<typeof fixtureFetch>;
  let cache: MemoryContentCache;

  beforeEach(async () => {
    release = await buildFixtureRelease();
    net = fixtureFetch(release.files, BASE);
    cache = new MemoryContentCache();
  });

  const client = () => createContentClient({ baseUrl: BASE, fetch: net.fetch, cache });

  describe('happy path', () => {
    it('resolves current → manifest → core and validates the bundle', async () => {
      const result = await client().getBundle('core');
      expect(result.releaseId).toBe(RELEASE_ID);
      expect(result.source).toBe('network');
      expect(result.data.careers[0]?.id).toBe('psy-1');
      expect(net.calls).toEqual([
        `${BASE}releases/current.json`,
        `${BASE}releases/${RELEASE_ID}/manifest.json`,
        `${BASE}releases/${RELEASE_ID}/core.json`,
      ]);
    });

    it('reports the content date for "Content updated [date]"', async () => {
      const current = await client().getCurrent();
      expect(current.data.contentDate).toBe('2026-10-20');
    });

    it('serves an immutable bundle from cache without refetching it', async () => {
      const c = client();
      await c.getBundle('core');
      net.calls.length = 0;
      const again = await c.getBundle('core');
      expect(again.source).toBe('cache');
      expect(net.calls).toEqual([`${BASE}releases/current.json`]);
    });
  });

  describe('integrity', () => {
    it('rejects a bundle whose hash does not match the manifest', async () => {
      const tampered = new Map(release.files);
      tampered.set(`releases/${RELEASE_ID}/core.json`, JSON.stringify({ tampered: true }));
      net = fixtureFetch(tampered, BASE);
      await expect(client().getBundle('core')).rejects.toBeInstanceOf(ContentIntegrityError);
    });

    it('rejects a manifest whose hash does not match current.json', async () => {
      const tampered = new Map(release.files);
      tampered.set(
        `releases/${RELEASE_ID}/manifest.json`,
        JSON.stringify({ ...release.manifest, contentDate: '2020-01-01' }),
      );
      net = fixtureFetch(tampered, BASE);
      await expect(client().getBundle('core')).rejects.toThrow(/manifest hash mismatch/);
    });

    it('rejects a bundle that matches its hash but fails schema validation', async () => {
      const bad = await buildFixtureRelease({
        coreText: JSON.stringify({ releaseId: RELEASE_ID, clusters: 'nope' }),
      });
      net = fixtureFetch(bad.files, BASE);
      await expect(client().getBundle('core')).rejects.toThrow(/schema validation failed/);
    });

    it('rejects a bundle whose releaseId disagrees with the manifest', async () => {
      const release2 = await buildFixtureRelease({
        coreText: JSON.stringify({
          ...(await import('./fixtures/release.ts')).core,
          releaseId: '2026-10-21.1',
        }),
      });
      net = fixtureFetch(release2.files, BASE);
      await expect(client().getBundle('core')).rejects.toThrow(/releaseId/);
    });

    it('does not cache anything that failed validation', async () => {
      const tampered = new Map(release.files);
      tampered.set(`releases/${RELEASE_ID}/core.json`, '{}');
      net = fixtureFetch(tampered, BASE);
      await expect(client().getBundle('core')).rejects.toThrow();
      expect(await cache.get(`bundle:${RELEASE_ID}:core`)).toBeUndefined();
    });

    it('treats non-JSON current.json as an integrity error, not a crash', async () => {
      const broken = new Map(release.files);
      broken.set('releases/current.json', '<html>captive portal</html>');
      net = fixtureFetch(broken, BASE);
      await expect(client().getCurrent()).rejects.toBeInstanceOf(ContentIntegrityError);
    });

    it('rejects current.json that fails its schema', async () => {
      const broken = new Map(release.files);
      broken.set('releases/current.json', JSON.stringify({ releaseId: 'latest' }));
      net = fixtureFetch(broken, BASE);
      await expect(client().getCurrent()).rejects.toThrow(/current.json schema/);
    });

    it('fails clearly when a bundle is not in the manifest', async () => {
      await expect(client().getBundle('countries/DE')).rejects.toThrow(/not in manifest/);
    });
  });

  describe('offline (04 §1.3, 02 §9.2)', () => {
    it('serves the last good release from cache when the network is down', async () => {
      await client().getBundle('core');
      net.goOffline();
      const result = await client().getBundle('core');
      expect(result.source).toBe('cache');
      expect(result.data.releaseId).toBe(RELEASE_ID);
    });

    it('throws ContentUnavailableError when the manifest cannot be fetched', async () => {
      const partial = new Map(release.files);
      partial.delete(`releases/${RELEASE_ID}/manifest.json`);
      net = fixtureFetch(partial, BASE);
      await expect(client().getBundle('core')).rejects.toBeInstanceOf(ContentUnavailableError);
    });

    it('throws ContentUnavailableError when the bundle file is missing', async () => {
      const partial = new Map(release.files);
      partial.delete(`releases/${RELEASE_ID}/core.json`);
      net = fixtureFetch(partial, BASE);
      await expect(client().getBundle('core')).rejects.toBeInstanceOf(ContentUnavailableError);
    });

    it('throws ContentUnavailableError offline with an empty cache', async () => {
      net.goOffline();
      await expect(client().getBundle('core')).rejects.toBeInstanceOf(ContentUnavailableError);
    });

    it('falls back to cache on an HTTP error for current.json', async () => {
      await client().getBundle('core');
      const broken = new Map(release.files);
      broken.delete('releases/current.json');
      net = fixtureFetch(broken, BASE);
      expect((await client().getCurrent()).source).toBe('cache');
    });
  });

  describe('release pinning (saved plans pin the release they were built on)', () => {
    it('getBundle with a pinned release id never consults current.json', async () => {
      const result = await client().getBundle('core', { releaseId: RELEASE_ID });
      expect(result.releaseId).toBe(RELEASE_ID);
      expect(net.calls).not.toContain(`${BASE}releases/current.json`);
    });

    it('a pinned release keeps working after current moves on', async () => {
      await client().getBundle('core');
      const next = await buildFixtureRelease({ releaseId: '2026-10-27.1' });
      const files = new Map([...release.files, ...next.files]);
      net = fixtureFetch(files, BASE);
      expect((await client().getBundle('core')).releaseId).toBe('2026-10-27.1');
      expect((await client().getBundle('core', { releaseId: RELEASE_ID })).releaseId).toBe(
        RELEASE_ID,
      );
    });

    it('rejects a malformed pinned release id before any request', async () => {
      await expect(client().getBundle('core', { releaseId: '../../etc' })).rejects.toThrow(
        /release id/i,
      );
      expect(net.calls).toEqual([]);
    });
  });
});
