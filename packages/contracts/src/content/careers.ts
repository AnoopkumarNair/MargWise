import { z } from 'zod';
import { CountryCode, Percentiles, Riasec, Slug } from '../primitives.ts';
import { fact, Provenance, SourcedOnlyProvenance } from '../provenance.ts';

export const ClusterId = z.enum(['psychology', 'tech-ai', 'commerce-business', 'design', 'law']);
export type ClusterId = z.infer<typeof ClusterId>;

export const Cluster = z.strictObject({
  id: ClusterId,
  title: z.string().min(1),
  summary: z.string().min(1),
});

/** O*NET-SOC code, e.g. `19-3033.00`. */
export const OnetSocCode = z
  .string()
  .regex(/^\d{2}-\d{4}\.\d{2}$/, 'Expected O*NET-SOC code like 19-3033.00');

/** Dossier sections every career must carry (01 §4.3). The release gate refuses a career missing one. */
export const REQUIRED_DOSSIER_SECTIONS = [
  'the_work',
  'career_ladder',
  'where_they_work',
  'routes',
  'eligibility_gates',
  'licensing',
  'colleges',
  'skills',
  'ai_exposure',
  'abroad',
  'quests',
  'honest_notes',
  'sources',
] as const;
export const DossierSectionKind = z.enum(REQUIRED_DOSSIER_SECTIONS);
export type DossierSectionKind = z.infer<typeof DossierSectionKind>;

export const DossierSection = z.strictObject({
  kind: DossierSectionKind,
  /** Reviewed prose (Markdown subset). Numbers in prose must also exist as facts. */
  body: z.string().min(1),
  sourceIds: z.array(z.uuid()),
});

export const Career = z
  .strictObject({
    id: Slug,
    clusterId: ClusterId,
    title: z.string().min(1),
    onet: z
      .array(
        z.strictObject({
          soc: OnetSocCode,
          release: z.string().min(1),
          note: z.string().optional(),
        }),
      )
      .min(1),
    sections: z.array(DossierSection),
  })
  .superRefine((career, ctx) => {
    const kinds = career.sections.map((s) => s.kind);
    if (new Set(kinds).size !== kinds.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate dossier section', path: ['sections'] });
    }
    for (const required of REQUIRED_DOSSIER_SECTIONS) {
      if (!kinds.includes(required)) {
        ctx.addIssue({
          code: 'custom',
          message: `Missing dossier section: ${required}`,
          path: ['sections'],
        });
      }
    }
  });
export type Career = z.infer<typeof Career>;

/** O*NET OnLine "Occupational Interest" display scale, 0–100 (database OI 0–6 × 100/6; release 31.0). */
const OiRating = z.number().min(0).max(100);

/**
 * O*NET Career Interest Type ratings (elements 1.B.1.a–f). Rule 3: only from
 * the O*NET database Interests file, never hand-authored.
 */
export const CareerInterestVector = z.strictObject({
  careerId: Slug,
  onetSoc: OnetSocCode,
  onetRelease: z.string().min(1),
  values: z.strictObject(
    Object.fromEntries(Riasec.options.map((k) => [k, OiRating])) as Record<Riasec, typeof OiRating>,
  ),
  provenance: SourcedOnlyProvenance.refine(
    (p) =>
      p.status === 'sourced' &&
      /^https:\/\/([a-z0-9-]+\.)*(onetcenter|onetonline)\.org\//.test(p.sourceUrl),
    'Interest vectors must come from O*NET (onetcenter.org or onetonline.org)',
  ),
});
export type CareerInterestVector = z.infer<typeof CareerInterestVector>;

const NonNegativePercentiles = Percentiles.refine((p) => p.p10 >= 0, 'Pay cannot be negative');

export const CareerLevel = z
  .strictObject({
    careerId: Slug,
    order: z.int().min(1).max(5),
    title: z.string().min(1),
    typicalYearsFrom: z.number().min(0),
    typicalYearsTo: z.number().min(0),
    /** Annual gross pay in INR. */
    payIndia: fact(NonNegativePercentiles),
    payAbroad: z.array(
      z.strictObject({
        country: CountryCode.exclude(['IN']),
        stage: z.enum(['entry', 'mid']),
        /** Annual gross pay in the country's currency. */
        pay: fact(NonNegativePercentiles),
      }),
    ),
  })
  .refine((l) => l.typicalYearsTo >= l.typicalYearsFrom, {
    message: 'typicalYearsTo must be ≥ typicalYearsFrom',
    path: ['typicalYearsTo'],
  });
export type CareerLevel = z.infer<typeof CareerLevel>;

export const RouteStage = z.strictObject({
  order: z.int().min(1),
  kind: z.enum(['ug', 'pg', 'bridge', 'professional', 'exam', 'internship', 'registration']),
  title: z.string().min(1),
  durationYears: fact(z.number().positive()),
  entranceTests: z.array(z.string().min(1)),
  country: CountryCode,
  officialUrl: z.url({ protocol: /^https$/ }).optional(),
});

export const Route = z
  .strictObject({
    id: Slug,
    careerId: Slug,
    title: z.string().min(1),
    kind: z.enum(['main', 'backup', 'adjacent']),
    stages: z.array(RouteStage).min(1),
  })
  .refine((r) => r.stages.every((s, i) => s.order === i + 1), {
    message: 'Route stages must be ordered 1..n',
    path: ['stages'],
  });
export type Route = z.infer<typeof Route>;

export const Licensing = z.strictObject({
  careerId: Slug,
  body: z.string().min(1),
  requirement: z.string().min(1),
  protectedTitles: z.array(z.string()),
  openQuestions: z.array(z.string()),
  provenance: Provenance,
});
