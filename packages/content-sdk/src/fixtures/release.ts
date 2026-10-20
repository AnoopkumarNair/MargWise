import {
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

export interface FixtureRelease {
  files: Map<string, string>;
  current: CurrentPointer;
  manifest: Manifest;
}

/** Builds `releases/current.json`, the manifest and the core bundle as served files. */
export async function buildFixtureRelease(
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
  const current: CurrentPointer = {
    releaseId,
    publishedAt: manifest.publishedAt,
    contentDate: manifest.contentDate,
    manifestSha256: await sha256Hex(manifestText),
  };
  const files = new Map<string, string>([
    ['releases/current.json', JSON.stringify(current)],
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
