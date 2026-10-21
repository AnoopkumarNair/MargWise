import {
  releaseSigningPayload,
  REQUIRED_DOSSIER_SECTIONS,
  type CoreBundle,
  type CurrentPointer,
  type Manifest,
} from '@margwise/contracts';

/**
 * A minimal, valid fixture release. Values are arbitrary test data, not facts,
 * and never ship to families.
 */
export const RELEASE_ID = '2026-10-20.1';

export const core: CoreBundle = {
  releaseId: RELEASE_ID,
  clusters: [{ id: 'psychology', title: 'Psychology', summary: 'Fixture cluster' }],
  careers: [
    {
      id: 'psy-1',
      clusterId: 'psychology',
      title: 'Fixture career',
      onet: [{ soc: '19-3033.00', release: '30.0' }],
      sections: REQUIRED_DOSSIER_SECTIONS.map((kind) => ({ kind, body: 'Fixture', sourceIds: [] })),
    },
  ],
  interestVectors: [],
  careerLevels: [],
  routes: [],
  subjects: [],
  gates: [],
  licensing: [],
  cities: [],
  cityCosts: [],
  loanSchemes: [],
  taxRules: [],
  fx: [],
  quests: [],
  examDates: [],
};

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const b64url = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('base64url');

export interface SigningKey {
  keyId: string;
  privateKey: CryptoKey;
  /** Raw 32-byte public key, base64url — what the app ships in its config. */
  publicKey: string;
}

export async function generateSigningKey(keyId = 'test-key'): Promise<SigningKey> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  return {
    keyId,
    privateKey: pair.privateKey,
    publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
  };
}

export async function signPointer(
  unsigned: Omit<CurrentPointer, 'signature' | 'keyId'>,
  key: SigningKey,
): Promise<CurrentPointer> {
  const withKey = { ...unsigned, keyId: key.keyId };
  const sig = await crypto.subtle.sign(
    { name: 'Ed25519' },
    key.privateKey,
    new TextEncoder().encode(releaseSigningPayload(withKey)),
  );
  return { ...withKey, signature: b64url(sig) };
}

export interface FixtureRelease {
  files: Map<string, string>;
  current: CurrentPointer;
  manifest: Manifest;
}

/** Builds `releases/current.json`, the manifest and the core bundle as served files. */
export async function buildFixtureRelease(
  key: SigningKey,
  overrides: { coreText?: string; releaseId?: string } = {},
): Promise<FixtureRelease> {
  const releaseId = overrides.releaseId ?? RELEASE_ID;
  const coreText = overrides.coreText ?? JSON.stringify({ ...core, releaseId });
  const manifest: Manifest = {
    releaseId,
    formatVersion: 1,
    publishedAt: '2026-10-20T10:00:00Z',
    contentDate: '2026-10-20',
    bundles: [
      {
        name: 'core',
        sha256: await sha256Hex(coreText),
        bytes: new TextEncoder().encode(coreText).length,
        schemaVersion: 1,
      },
    ],
  };
  const manifestText = JSON.stringify(manifest);
  const current = await signPointer(
    {
      releaseId,
      publishedAt: manifest.publishedAt,
      contentDate: manifest.contentDate,
      manifestSha256: await sha256Hex(manifestText),
    },
    key,
  );
  const files = new Map<string, string>([
    ['releases/current.json', JSON.stringify(current)],
    [`releases/${releaseId}/release.json`, JSON.stringify(current)],
    [`releases/${releaseId}/manifest.json`, manifestText],
    [`releases/${releaseId}/core.json`, coreText],
  ]);
  return { files, current, manifest };
}

/** A fetch stand-in that serves fixture files and records every request URL. */
export function fixtureFetch(files: Map<string, string>, base: string) {
  const calls: string[] = [];
  let offline = false;
  const fetchFn = async (input: string | URL): Promise<Response> => {
    const url = String(input);
    calls.push(url);
    if (offline) throw new TypeError('Failed to fetch');
    const body = files.get(url.slice(base.length));
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(body, { status: 200 });
  };
  return {
    fetch: fetchFn,
    calls,
    goOffline: () => {
      offline = true;
    },
    goOnline: () => {
      offline = false;
    },
  };
}
