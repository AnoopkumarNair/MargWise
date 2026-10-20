import { RIASEC_ORDER, type Instrument, type InstrumentItem } from '@margwise/contracts';
import items from './data/onet-ipsf-v1.items.json' with { type: 'json' };

/**
 * Interleaves areas in paper order: R1 I1 A1 S1 E1 C1 R2 … C10 (D-026, interim
 * until the O*NET Web Services electronic order is available).
 */
function interleavedOrder(list: readonly InstrumentItem[]): string[] {
  const order: string[] = [];
  for (let n = 1; n <= 10; n++) for (const area of RIASEC_ORDER) order.push(`${area}${n}`);
  if (!order.every((id) => list.some((i) => i.id === id)))
    throw new Error('Instrument items incomplete');
  return order;
}

const ITEMS = items as InstrumentItem[];

/**
 * O*NET Interest Profiler Short Form, 60 items transcribed verbatim from the
 * official paper form by `scripts/instrument/transcribe_ipsf.py` and checked
 * against an independent hand transcription in `instrument.test.ts`.
 */
export const ONET_IPSF: Instrument = {
  id: 'onet-ipsf',
  version: 'paper-v1-2024-11-04',
  source: {
    title: 'O*NET Interest Profiler Short Form (paper-and-pencil), v1, 11.04.24',
    url: 'https://www.onetcenter.org/dl_tools/ipsf/Interest_Profiler.pdf',
    publisher: 'National Center for O*NET Development for USDOL/ETA',
    retrievedOn: '2026-10-20',
    pdfSha256: '080e07f6ea5af5751f75e05cb96c77be77e14c12403097de9a39b61030ca528d',
  },
  licence: 'O*NET Tools Developer License',
  attribution:
    'This application includes information from the O*NET Career Exploration Tools (https://www.onetcenter.org/tools.html) by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the O*NET Tools Developer License (https://www.onetcenter.org/license_tools.html). O*NET® is a trademark of USDOL/ETA. Margwise has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications.',
  modificationNote:
    'Margwise has modified all of, a portion of, or the purpose of the O*NET® Career Exploration Tools. The U.S. Department of Labor, Employment and Training Administration (USDOL/ETA) has not approved, endorsed, or tested these modifications. As such, USDOL/ETA will not be liable to any third party or end-user for any damages arising out of or from the use or misuse of the modified O*NET Career Exploration Tools or any products incorporating or containing the modified O*NET Career Exploration Tools. Modifications: the 60 items are presented one at a time inside a story game with illustrations, in an interleaved order, using the five-point response scale of the web-based Short Form; item wording and scoring are unchanged.',
  anchors: [
    { value: 0, label: 'Strongly dislike' },
    { value: 1, label: 'Dislike' },
    { value: 2, label: 'Unsure' },
    { value: 3, label: 'Like' },
    { value: 4, label: 'Strongly like' },
  ],
  items: ITEMS,
  presentationOrder: { basis: 'interleaved-paper-order', itemIds: interleavedOrder(ITEMS) },
};
