import { describe, expect, it } from 'vitest';
import { sourcedProv } from './content/fixtures.ts';
import { REQUIRED_DOSSIER_SECTIONS } from './content/careers.ts';
import { BundleName, CoreBundle, CurrentPointer, Manifest, ReleaseId } from './release.ts';

const sha = 'a'.repeat(64);

describe('ReleaseId', () => {
  it.each(['2026-10-20.1', '2026-10-20.12'])('accepts %s', (id) =>
    expect(ReleaseId.safeParse(id).success).toBe(true),
  );
  it.each(['2026-10-20', 'latest', '20261020.1'])('rejects %s', (id) =>
    expect(ReleaseId.safeParse(id).success).toBe(false),
  );
});

describe('BundleName', () => {
  it.each([
    'core',
    'colleges/b-tech-cse',
    'countries/DE',
    'policy-weather',
    'ai-exposure',
    'bounds',
  ])('accepts %s', (n) => expect(BundleName.safeParse(n).success).toBe(true));
  it.each(['colleges/', 'countries/IN', 'countries/FR', '../core', 'misc'])('rejects %s', (n) =>
    expect(BundleName.safeParse(n).success).toBe(false),
  );
});

describe('CurrentPointer', () => {
  it('pins the manifest by hash', () => {
    const p = {
      releaseId: '2026-10-20.1',
      publishedAt: '2026-10-20T10:00:00Z',
      contentDate: '2026-10-20',
      manifestSha256: sha,
    };
    expect(CurrentPointer.safeParse(p).success).toBe(true);
    expect(CurrentPointer.safeParse({ ...p, manifestSha256: 'xyz' }).success).toBe(false);
  });
});

describe('Manifest', () => {
  const manifest = {
    releaseId: '2026-10-20.1',
    formatVersion: 1,
    publishedAt: '2026-10-20T10:00:00Z',
    contentDate: '2026-10-20',
    bundles: [
      { name: 'core', sha256: sha, bytes: 10, schemaVersion: 1 },
      { name: 'bounds', sha256: sha, bytes: 10, schemaVersion: 1 },
    ],
  };

  it('accepts unique bundles including core', () => {
    expect(Manifest.safeParse(manifest).success).toBe(true);
  });

  it('rejects a manifest without core', () => {
    expect(Manifest.safeParse({ ...manifest, bundles: manifest.bundles.slice(1) }).success).toBe(
      false,
    );
  });

  it('rejects duplicate bundle names', () => {
    expect(
      Manifest.safeParse({ ...manifest, bundles: [...manifest.bundles, manifest.bundles[0]] })
        .success,
    ).toBe(false);
  });
});

describe('CoreBundle referential integrity (05 §9: broken reference refuses the release)', () => {
  const career = {
    id: 'psy-1',
    clusterId: 'psychology',
    title: 'Fixture',
    onet: [{ soc: '19-3033.00', release: '30.0' }],
    sections: REQUIRED_DOSSIER_SECTIONS.map((kind) => ({ kind, body: 'x', sourceIds: [] })),
  };
  const core = {
    releaseId: '2026-10-20.1',
    clusters: [{ id: 'psychology', title: 'Psychology', summary: 'x' }],
    careers: [career],
    interestVectors: [],
    careerLevels: [],
    routes: [],
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

  it('accepts a consistent bundle', () => {
    expect(CoreBundle.safeParse(core).success).toBe(true);
  });

  it('rejects a career whose cluster is not in the bundle', () => {
    const result = CoreBundle.safeParse({ ...core, clusters: [] });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('Unknown cluster psychology');
  });

  it('rejects a gate pointing at a missing route', () => {
    const gate = {
      routeId: 'nope',
      subjectCombination: 'pcm',
      status: 'OPEN',
      reason: 'x',
      provenance: sourcedProv(),
    };
    const result = CoreBundle.safeParse({ ...core, gates: [gate] });
    expect(JSON.stringify(result.error?.issues)).toContain('Unknown route nope');
  });

  it('rejects a quest for an unknown career', () => {
    const quest = {
      id: 'q-1',
      careerId: 'ghost',
      title: 't',
      goal: 'g',
      steps: ['a', 'b', 'c'],
      timeNeeded: '1 week',
      whatToNotice: 'n',
      reflections: [
        { prompt: 'p', options: ['a', 'b'] },
        { prompt: 'p', options: ['a', 'b'] },
      ],
      safety: { needsParentHelp: false },
    };
    const result = CoreBundle.safeParse({ ...core, quests: [quest] });
    expect(JSON.stringify(result.error?.issues)).toContain('Unknown career ghost');
  });

  it('rejects duplicate career ids', () => {
    expect(CoreBundle.safeParse({ ...core, careers: [career, career] }).success).toBe(false);
  });
});
