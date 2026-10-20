import {
  CurrentPointer,
  Manifest,
  ReleaseId,
  releaseSigningPayload,
  schemaForBundle,
  type AiExposureBundle,
  type BoundsBundle,
  type BundleName,
  type CollegesBundle,
  type CoreBundle,
  type CountryBundle,
  type PolicyWeatherBundle,
} from '@margwise/contracts';
import type { z } from 'zod';
import type { ContentCache } from './cache.ts';
import { ContentIntegrityError, ContentUnavailableError } from './errors.ts';

export type BundleData<N extends BundleName> = N extends 'core'
  ? CoreBundle
  : N extends 'bounds'
    ? z.infer<typeof BoundsBundle>
    : N extends 'ai-exposure'
      ? z.infer<typeof AiExposureBundle>
      : N extends 'policy-weather'
        ? z.infer<typeof PolicyWeatherBundle>
        : N extends `colleges/${string}`
          ? CollegesBundle
          : CountryBundle;

export interface Loaded<T> {
  data: T;
  releaseId: ReleaseId;
  /** `network` = fetched and verified now; `cache` = last verified copy on this device. */
  source: 'network' | 'cache';
}

export interface ContentClientOptions {
  /** Root of the public releases bucket, ending in `/`. */
  baseUrl: string;
  fetch: (input: string) => Promise<Response>;
  cache: ContentCache;
  /**
   * Ed25519 public keys (raw 32 bytes, base64url) by key id. More than one
   * allows key rotation. Pointers signed by any other key are rejected.
   */
  trustedKeys: Readonly<Record<string, string>>;
}

const KEY = {
  current: 'current',
  manifest: (id: string) => `manifest:${id}`,
  bundle: (id: string, name: string) => `bundle:${id}:${name}`,
};

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ContentIntegrityError(`${what} is not valid JSON`);
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function createContentClient({ baseUrl, fetch, cache, trustedKeys }: ContentClientOptions) {
  const keys = new Map<string, Promise<CryptoKey>>();

  async function verifyPointer(pointer: CurrentPointer, where: string): Promise<void> {
    const raw = trustedKeys[pointer.keyId];
    if (raw === undefined)
      throw new ContentIntegrityError(`${where}: unknown signing key ${pointer.keyId}`);
    let key = keys.get(pointer.keyId);
    if (!key) {
      key = crypto.subtle.importKey('raw', fromBase64Url(raw), { name: 'Ed25519' }, false, [
        'verify',
      ]);
      keys.set(pointer.keyId, key);
    }
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' },
      await key,
      fromBase64Url(pointer.signature),
      new TextEncoder().encode(releaseSigningPayload(pointer)),
    );
    if (!ok) throw new ContentIntegrityError(`${where}: invalid signature`);
  }

  /** Returns the body text, or `undefined` when the network is unavailable or errors. */
  async function fetchText(path: string): Promise<string | undefined> {
    try {
      const res = await fetch(`${baseUrl}${path}`);
      return res.ok ? await res.text() : undefined;
    } catch {
      return undefined;
    }
  }

  async function getCurrent(): Promise<Loaded<CurrentPointer>> {
    const text = await fetchText('releases/current.json');
    if (text !== undefined) {
      const parsed = CurrentPointer.safeParse(parseJson(text, 'current.json'));
      if (!parsed.success) throw new ContentIntegrityError('current.json schema validation failed');
      await verifyPointer(parsed.data, 'current.json');
      await cache.put(KEY.current, parsed.data);
      return { data: parsed.data, releaseId: parsed.data.releaseId, source: 'network' };
    }
    const cached = CurrentPointer.safeParse(await cache.get(KEY.current));
    if (cached.success)
      return { data: cached.data, releaseId: cached.data.releaseId, source: 'cache' };
    throw new ContentUnavailableError('No network and no cached release on this device');
  }

  async function getManifest(releaseId: ReleaseId, expectedSha256?: string): Promise<Manifest> {
    const cached = Manifest.safeParse(await cache.get(KEY.manifest(releaseId)));
    if (cached.success) return cached.data;
    const text = await fetchText(`releases/${releaseId}/manifest.json`);
    if (text === undefined)
      throw new ContentUnavailableError(`Manifest for ${releaseId} unavailable`);
    if (expectedSha256 !== undefined && (await sha256Hex(text)) !== expectedSha256) {
      throw new ContentIntegrityError(`manifest hash mismatch for ${releaseId}`);
    }
    const parsed = Manifest.safeParse(parseJson(text, 'manifest'));
    if (!parsed.success || parsed.data.releaseId !== releaseId) {
      throw new ContentIntegrityError(`manifest schema validation failed for ${releaseId}`);
    }
    await cache.put(KEY.manifest(releaseId), parsed.data);
    return parsed.data;
  }

  /**
   * For a pinned release whose manifest is not cached yet, fetch and verify the
   * release's own signed `release.json`, so the manifest is still hash-checked.
   */
  async function pinnedManifestHash(releaseId: ReleaseId): Promise<string | undefined> {
    if (Manifest.safeParse(await cache.get(KEY.manifest(releaseId))).success) return undefined;
    const text = await fetchText(`releases/${releaseId}/release.json`);
    if (text === undefined)
      throw new ContentUnavailableError(`release.json for ${releaseId} unavailable`);
    const parsed = CurrentPointer.safeParse(parseJson(text, 'release.json'));
    if (!parsed.success) throw new ContentIntegrityError('release.json schema validation failed');
    if (parsed.data.releaseId !== releaseId)
      throw new ContentIntegrityError(`release.json does not match ${releaseId}`);
    await verifyPointer(parsed.data, 'release.json');
    return parsed.data.manifestSha256;
  }

  /**
   * Loads a bundle, verifying its hash against the manifest and validating it
   * with the contract schema before it is cached or returned. Pass `releaseId`
   * to pin a release (saved plans); otherwise `current.json` decides.
   */
  async function getBundle<N extends BundleName>(
    name: N,
    opts: { releaseId?: string } = {},
  ): Promise<Loaded<BundleData<N>>> {
    let releaseId: ReleaseId;
    let manifestSha: string | undefined;
    if (opts.releaseId !== undefined) {
      const pinned = ReleaseId.safeParse(opts.releaseId);
      if (!pinned.success) throw new ContentIntegrityError(`Invalid release id: ${opts.releaseId}`);
      releaseId = pinned.data;
      manifestSha = await pinnedManifestHash(releaseId);
    } else {
      const current = await getCurrent();
      releaseId = current.releaseId;
      manifestSha = current.data.manifestSha256;
    }

    const schema = schemaForBundle(name);
    const cached = schema.safeParse(await cache.get(KEY.bundle(releaseId, name)));
    if (cached.success) return { data: cached.data as BundleData<N>, releaseId, source: 'cache' };

    const manifest = await getManifest(releaseId, manifestSha);
    const entry = manifest.bundles.find((b) => b.name === name);
    if (!entry) throw new ContentIntegrityError(`Bundle ${name} not in manifest ${releaseId}`);

    const text = await fetchText(`releases/${releaseId}/${name}.json`);
    if (text === undefined)
      throw new ContentUnavailableError(`Bundle ${name} for ${releaseId} unavailable`);
    if ((await sha256Hex(text)) !== entry.sha256)
      throw new ContentIntegrityError(`bundle hash mismatch for ${name}`);

    const parsed = schema.safeParse(parseJson(text, name));
    if (!parsed.success)
      throw new ContentIntegrityError(`${name} schema validation failed: ${parsed.error.message}`);
    if (parsed.data.releaseId !== releaseId)
      throw new ContentIntegrityError(`${name} releaseId does not match manifest`);

    await cache.put(KEY.bundle(releaseId, name), parsed.data);
    return { data: parsed.data as BundleData<N>, releaseId, source: 'network' };
  }

  return { getCurrent, getManifest, getBundle };
}

export type ContentClient = ReturnType<typeof createContentClient>;
