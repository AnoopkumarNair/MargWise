import { z } from 'zod';
import { HttpsUrl, IsoDate, Riasec } from '../primitives.ts';

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * O*NET Interest Profiler Short Form as data (rule 3, ADR 006). Item text is
 * verbatim; the game changes delivery only. `presentationOrder` is a separate
 * list so the order can change (D-026) without touching wording or scoring.
 */
export const ItemId = z.string().regex(/^[RIASEC](10|[1-9])$/, 'Expected item id like R1 … C10');

export const InstrumentItem = z
  .strictObject({
    id: ItemId,
    area: Riasec,
    /** Verbatim activity text from the official form. */
    text: z.string().min(1),
    /** Position on the official paper form within its area block. */
    paper: z.strictObject({
      column: z.union([z.literal(1), z.literal(2)]),
      row: z.int().min(1).max(5),
    }),
  })
  .refine((i) => i.id.startsWith(i.area), {
    message: 'Item id must start with its area letter',
    path: ['id'],
  });
export type InstrumentItem = z.infer<typeof InstrumentItem>;

export const ResponseAnchor = z.strictObject({
  value: z.int().min(0).max(4),
  label: z.string().min(1),
});

export const Instrument = z
  .strictObject({
    id: z.literal('onet-ipsf'),
    version: z.string().min(1),
    source: z.strictObject({
      title: z.string().min(1),
      url: HttpsUrl,
      publisher: z.string().min(1),
      retrievedOn: IsoDate,
      /** SHA-256 of the PDF the items were transcribed from. */
      pdfSha256: Sha256Hex,
    }),
    /** CC BY-ND 4.0 for verbatim copies; the Developer License for modified delivery (D-031). */
    licence: z.enum(['O*NET Tools Developer License', 'CC BY-ND 4.0']),
    /** Shown verbatim on the About/Attribution screen. */
    attribution: z.string().min(1),
    modificationNote: z.string().min(1),
    anchors: z.array(ResponseAnchor).length(5),
    items: z.array(InstrumentItem).length(60),
    presentationOrder: z.strictObject({
      basis: z.enum(['interleaved-paper-order', 'onet-web-services']),
      itemIds: z.array(ItemId).length(60),
    }),
  })
  .superRefine((inst, ctx) => {
    inst.anchors.forEach((a, i) => {
      if (a.value !== i)
        ctx.addIssue({
          code: 'custom',
          message: 'Anchors must be 0–4 in order',
          path: ['anchors', i],
        });
    });
    const ids = inst.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate item id', path: ['items'] });
    for (const area of Riasec.options) {
      const n = inst.items.filter((i) => i.area === area).length;
      if (n !== 10)
        ctx.addIssue({
          code: 'custom',
          message: `Area ${area} has ${n} items, expected 10`,
          path: ['items'],
        });
    }
    const order = inst.presentationOrder.itemIds;
    if (new Set(order).size !== 60 || order.some((id) => !ids.includes(id))) {
      ctx.addIssue({
        code: 'custom',
        message: 'presentationOrder must be a permutation of the item ids',
        path: ['presentationOrder'],
      });
    }
  });
export type Instrument = z.infer<typeof Instrument>;
