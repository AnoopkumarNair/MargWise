import { z } from 'zod';
import { CompareBounds, FxRate, LoanScheme, MoneyDefaults, TaxRules } from './content/money.ts';
import {
  Career,
  CareerInterestVector,
  CareerLevel,
  Cluster,
  Licensing,
  Route,
} from './content/careers.ts';
import { Gate, Subject } from './content/subjects.ts';
import {
  AbroadUniversity,
  Cutoff,
  Institution,
  NirfMetric,
  Programme,
  ProgrammeFee,
} from './content/colleges.ts';
import { AiExposure, ExamDate, Quest } from './content/guidance.ts';
import { CareerCountryFit, City, CityCost, CountryCost, CountryPolicy } from './content/places.ts';
import { CountryCode, IsoDate, IsoDateTime, Slug } from './primitives.ts';

/** `YYYY-MM-DD.N` — date of publication plus a same-day sequence number. */
export const ReleaseId = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}\.\d+$/, 'Expected release id like 2026-10-20.1');
export type ReleaseId = z.infer<typeof ReleaseId>;

export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'Expected lowercase hex SHA-256');

const abroad = CountryCode.exclude(['IN']).options.join('|');
export const BundleName = z
  .string()
  .regex(
    new RegExp(
      `^(core|policy-weather|ai-exposure|bounds|colleges/[a-z0-9]+(?:-[a-z0-9]+)*|countries/(?:${abroad}))$`,
    ),
    'Unknown bundle name',
  );
export type BundleName = z.infer<typeof BundleName>;

/** `releases/current.json` — the only mutable file; it pins the live manifest by hash. */
export const CurrentPointer = z.strictObject({
  releaseId: ReleaseId,
  publishedAt: IsoDateTime,
  contentDate: IsoDate,
  manifestSha256: Sha256Hex,
});
export type CurrentPointer = z.infer<typeof CurrentPointer>;

export const ManifestEntry = z.strictObject({
  name: BundleName,
  sha256: Sha256Hex,
  bytes: z.int().positive(),
  schemaVersion: z.int().positive(),
});

export const Manifest = z
  .strictObject({
    releaseId: ReleaseId,
    formatVersion: z.literal(1),
    publishedAt: IsoDateTime,
    contentDate: IsoDate,
    bundles: z.array(ManifestEntry).min(1),
  })
  .refine((m) => new Set(m.bundles.map((b) => b.name)).size === m.bundles.length, {
    message: 'Duplicate bundle',
    path: ['bundles'],
  })
  .refine((m) => m.bundles.some((b) => b.name === 'core'), {
    message: 'Manifest must include core',
    path: ['bundles'],
  });
export type Manifest = z.infer<typeof Manifest>;

type Ctx = z.RefinementCtx;
function uniqueIds(ctx: Ctx, path: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) ctx.addIssue({ code: 'custom', message: `Duplicate id ${id}`, path: [path] });
    seen.add(id);
  }
  return seen;
}
function mustExist(ctx: Ctx, path: string, kind: string, known: Set<string>, refs: string[]) {
  refs.forEach((ref, i) => {
    if (!known.has(ref))
      ctx.addIssue({ code: 'custom', message: `Unknown ${kind} ${ref}`, path: [path, i] });
  });
}

export const CoreBundle = z
  .strictObject({
    releaseId: ReleaseId,
    clusters: z.array(Cluster),
    careers: z.array(Career),
    interestVectors: z.array(CareerInterestVector),
    careerLevels: z.array(CareerLevel),
    routes: z.array(Route),
    subjects: z.array(Subject),
    gates: z.array(Gate),
    licensing: z.array(Licensing),
    cities: z.array(City),
    cityCosts: z.array(CityCost),
    loanSchemes: z.array(LoanScheme),
    taxRules: z.array(TaxRules),
    fx: z.array(FxRate),
    moneyDefaults: MoneyDefaults.optional(),
    quests: z.array(Quest),
    examDates: z.array(ExamDate),
  })
  .superRefine((b, ctx) => {
    const clusters = uniqueIds(
      ctx,
      'clusters',
      b.clusters.map((c) => c.id),
    );
    const careers = uniqueIds(
      ctx,
      'careers',
      b.careers.map((c) => c.id),
    );
    const routes = uniqueIds(
      ctx,
      'routes',
      b.routes.map((r) => r.id),
    );
    const cities = uniqueIds(
      ctx,
      'cities',
      b.cities.map((c) => c.id),
    );
    uniqueIds(
      ctx,
      'quests',
      b.quests.map((q) => q.id),
    );
    uniqueIds(
      ctx,
      'loanSchemes',
      b.loanSchemes.map((s) => s.id),
    );
    mustExist(
      ctx,
      'careers',
      'cluster',
      clusters,
      b.careers.map((c) => c.clusterId),
    );
    mustExist(
      ctx,
      'interestVectors',
      'career',
      careers,
      b.interestVectors.map((v) => v.careerId),
    );
    mustExist(
      ctx,
      'careerLevels',
      'career',
      careers,
      b.careerLevels.map((l) => l.careerId),
    );
    mustExist(
      ctx,
      'routes',
      'career',
      careers,
      b.routes.map((r) => r.careerId),
    );
    mustExist(
      ctx,
      'gates',
      'route',
      routes,
      b.gates.map((g) => g.routeId),
    );
    const subjectKeys = new Set(b.subjects.map((s) => s.key));
    mustExist(
      ctx,
      'gates',
      'subject',
      subjectKeys,
      b.gates.flatMap((g) => [...g.requirement.allOf, ...g.requirement.anyOf.flat()]),
    );
    mustExist(
      ctx,
      'licensing',
      'career',
      careers,
      b.licensing.map((l) => l.careerId),
    );
    mustExist(
      ctx,
      'cityCosts',
      'city',
      cities,
      b.cityCosts.map((c) => c.cityId),
    );
    mustExist(
      ctx,
      'quests',
      'career',
      careers,
      b.quests.map((q) => q.careerId),
    );
  });
export type CoreBundle = z.infer<typeof CoreBundle>;

export const CollegesBundle = z
  .strictObject({
    releaseId: ReleaseId,
    courseCode: Slug,
    institutions: z.array(Institution),
    programmes: z.array(Programme),
    fees: z.array(ProgrammeFee),
    cutoffs: z.array(Cutoff),
    nirf: z.array(NirfMetric),
  })
  .superRefine((b, ctx) => {
    const institutions = uniqueIds(
      ctx,
      'institutions',
      b.institutions.map((i) => i.id),
    );
    const programmes = uniqueIds(
      ctx,
      'programmes',
      b.programmes.map((p) => p.id),
    );
    mustExist(
      ctx,
      'programmes',
      'institution',
      institutions,
      b.programmes.map((p) => p.institutionId),
    );
    mustExist(
      ctx,
      'fees',
      'programme',
      programmes,
      b.fees.map((f) => f.programmeId),
    );
    mustExist(
      ctx,
      'cutoffs',
      'programme',
      programmes,
      b.cutoffs.map((c) => c.programmeId),
    );
    mustExist(
      ctx,
      'nirf',
      'institution',
      institutions,
      b.nirf.map((n) => n.institutionId),
    );
  });
export type CollegesBundle = z.infer<typeof CollegesBundle>;

export const CountryBundle = z.strictObject({
  releaseId: ReleaseId,
  country: CountryCode.exclude(['IN']),
  costs: z.array(CountryCost),
  policies: z.array(CountryPolicy),
  careerFit: z.array(CareerCountryFit),
  universities: z.array(AbroadUniversity),
});
export type CountryBundle = z.infer<typeof CountryBundle>;

export const PolicyWeatherBundle = z.strictObject({
  releaseId: ReleaseId,
  items: z.array(CountryPolicy),
});
export const AiExposureBundle = z.strictObject({
  releaseId: ReleaseId,
  methodUrl: z.string().min(1),
  items: z.array(AiExposure),
});
export const BoundsBundle = z.strictObject({ releaseId: ReleaseId, bounds: CompareBounds });

/** Schema for each bundle kind, used by content-sdk to validate every download. */
export function schemaForBundle(name: BundleName) {
  if (name === 'core') return CoreBundle;
  if (name === 'policy-weather') return PolicyWeatherBundle;
  if (name === 'ai-exposure') return AiExposureBundle;
  if (name === 'bounds') return BoundsBundle;
  if (name.startsWith('colleges/')) return CollegesBundle;
  return CountryBundle;
}
