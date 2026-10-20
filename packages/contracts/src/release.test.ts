import { describe, expect, it } from 'vitest';
import { sourcedProv } from './content/fixtures.ts';
import { REQUIRED_DOSSIER_SECTIONS } from './content/careers.ts';
import {
  AiExposureBundle,
  BoundsBundle,
  BundleName,
  CollegesBundle,
  CoreBundle,
  CountryBundle,
  CurrentPointer,
  Manifest,
  PolicyWeatherBundle,
  ReleaseId,
  schemaForBundle,
} from './release.ts';

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

describe('schemaForBundle', () => {
  it.each([
    ['core', CoreBundle],
    ['colleges/b-tech-cse', CollegesBundle],
    ['countries/DE', CountryBundle],
    ['policy-weather', PolicyWeatherBundle],
    ['ai-exposure', AiExposureBundle],
    ['bounds', BoundsBundle],
  ] as const)('maps %s to its schema', (name, schema) => {
    expect(schemaForBundle(name)).toBe(schema);
  });
});

describe('CollegesBundle referential integrity', () => {
  const institution = {
    id: 'inst-a',
    name: 'Institute A',
    type: 'public',
    cityId: 'pune',
    country: 'IN',
    approvals: [],
  };
  const programme = {
    id: 'inst-a-btech-cse',
    institutionId: 'inst-a',
    courseCode: 'b-tech-cse',
    normalisedCode: 'BTECH-CSE',
    campus: 'main',
    name: 'B.Tech CSE',
    year: 2026,
    intake: { notReported: true },
    status: 'active',
    entranceTests: ['JEE Main'],
  };
  const bundle = {
    releaseId: '2026-10-20.1',
    courseCode: 'b-tech-cse',
    institutions: [institution],
    programmes: [programme],
    fees: [],
    cutoffs: [],
    nirf: [],
  };

  it('accepts a consistent bundle', () => {
    expect(CollegesBundle.safeParse(bundle).success).toBe(true);
  });

  it('rejects a programme at an unknown institution', () => {
    const result = CollegesBundle.safeParse({ ...bundle, institutions: [] });
    expect(JSON.stringify(result.error?.issues)).toContain('Unknown institution inst-a');
  });

  it('rejects a fee for an unknown programme', () => {
    const result = CollegesBundle.safeParse({
      ...bundle,
      fees: [{ programmeId: 'ghost', year: 2026, annualInr: { notReported: true } }],
    });
    expect(JSON.stringify(result.error?.issues)).toContain('Unknown programme ghost');
  });
});

describe('CountryBundle', () => {
  it('rejects IN as an abroad country', () => {
    const b = {
      releaseId: '2026-10-20.1',
      country: 'IN',
      costs: [],
      policies: [],
      careerFit: [],
      universities: [],
    };
    expect(CountryBundle.safeParse(b).success).toBe(false);
    expect(CountryBundle.safeParse({ ...b, country: 'DE' }).success).toBe(true);
  });
});

describe('BoundsBundle', () => {
  const bound = { min: 0, max: 1 };
  const bounds = {
    npvP50: bound,
    npvP10: bound,
    peakEmiShare: bound,
    yearsToFirstSalary: bound,
    computedAt: '2026-10-20T10:00:00Z',
  };

  it('accepts min < max bounds', () => {
    expect(BoundsBundle.safeParse({ releaseId: '2026-10-20.1', bounds }).success).toBe(true);
  });

  it('rejects a degenerate bound (normalisation would divide by zero)', () => {
    expect(
      BoundsBundle.safeParse({
        releaseId: '2026-10-20.1',
        bounds: { ...bounds, npvP50: { min: 1, max: 1 } },
      }).success,
    ).toBe(false);
  });
});

describe('CoreBundle — every cross-reference is enforced', () => {
  const prov = sourcedProv();
  const base = {
    releaseId: '2026-10-20.1',
    clusters: [{ id: 'psychology', title: 'Psychology', summary: 'x' }],
    careers: [],
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
  const cases: Array<[string, Record<string, unknown[]>, string]> = [
    [
      'interestVectors',
      {
        interestVectors: [
          {
            careerId: 'ghost',
            onetSoc: '19-3033.00',
            onetRelease: '30.0',
            values: { R: 1, I: 1, A: 1, S: 1, E: 1, C: 1 },
            provenance: sourcedProv({ sourceUrl: 'https://www.onetcenter.org/x' }),
          },
        ],
      },
      'Unknown career ghost',
    ],
    [
      'careerLevels',
      {
        careerLevels: [
          {
            careerId: 'ghost',
            order: 1,
            title: 't',
            typicalYearsFrom: 0,
            typicalYearsTo: 1,
            payIndia: { value: { p10: 1, p50: 2, p90: 3 }, provenance: prov },
            payAbroad: [],
          },
        ],
      },
      'Unknown career ghost',
    ],
    [
      'routes',
      {
        routes: [
          {
            id: 'r',
            careerId: 'ghost',
            title: 't',
            kind: 'main',
            stages: [
              {
                order: 1,
                kind: 'ug',
                title: 'u',
                durationYears: { value: 3, provenance: prov },
                entranceTests: [],
                country: 'IN',
              },
            ],
          },
        ],
      },
      'Unknown career ghost',
    ],
    [
      'licensing',
      {
        licensing: [
          {
            careerId: 'ghost',
            body: 'RCI',
            requirement: 'r',
            protectedTitles: [],
            openQuestions: [],
            provenance: prov,
          },
        ],
      },
      'Unknown career ghost',
    ],
    [
      'cityCosts',
      {
        cityCosts: [
          {
            cityId: 'atlantis',
            item: 'food',
            annualInr: { value: { low: 1, likely: 2, high: 3 }, provenance: prov },
          },
        ],
      },
      'Unknown city atlantis',
    ],
  ];

  it.each(cases)('%s', (_name, patch, message) => {
    const result = CoreBundle.safeParse({ ...base, ...patch });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(message);
  });
});

describe('CollegesBundle — cutoffs and NIRF references', () => {
  const base = {
    releaseId: '2026-10-20.1',
    courseCode: 'b-tech-cse',
    institutions: [],
    programmes: [],
    fees: [],
    cutoffs: [],
    nirf: [],
  };

  it('rejects a cutoff for an unknown programme', () => {
    const cutoff = {
      programmeId: 'ghost',
      year: 2026,
      round: 1,
      quota: 'AI',
      category: 'OPEN',
      seatPool: 'gn',
      openingRank: 1,
      closingRank: 2,
      provenance: sourcedProv(),
    };
    expect(
      JSON.stringify(CollegesBundle.safeParse({ ...base, cutoffs: [cutoff] }).error?.issues),
    ).toContain('Unknown programme ghost');
  });

  it('rejects a NIRF metric for an unknown institution', () => {
    const nirf = {
      institutionId: 'ghost',
      year: 2026,
      metric: 'rank',
      value: { notReported: true },
    };
    expect(
      JSON.stringify(CollegesBundle.safeParse({ ...base, nirf: [nirf] }).error?.issues),
    ).toContain('Unknown institution ghost');
  });
});
