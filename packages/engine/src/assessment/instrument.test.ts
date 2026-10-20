import { Instrument } from '@margwise/contracts';
import { describe, expect, it } from 'vitest';
import { ONET_IPSF } from './instrument.ts';

/**
 * Instrument snapshot (03 §2.6, rule 3). The JSON is generated from the
 * official PDF text; this list was typed independently from the printed form.
 * Agreement between the two is the transcription check. Any wording change
 * must fail here and needs Anu's approval.
 */
const EXPECTED: Record<string, readonly string[]> = {
  R: [
    'Build kitchen cabinets',
    'Lay brick or tile',
    'Repair household appliances',
    'Raise fish in a fish hatchery',
    'Assemble electronic parts',
    'Drive a truck to deliver packages to offices and homes',
    'Test the quality of parts before shipment',
    'Repair and install locks',
    'Set up and operate machines to make products',
    'Put out forest fires',
  ],
  I: [
    'Develop a new medicine',
    'Study ways to reduce water pollution',
    'Conduct chemical experiments',
    'Study the movement of planets',
    'Examine blood samples using a microscope',
    'Investigate the cause of a fire',
    'Develop a way to better predict the weather',
    'Work in a biology lab',
    'Invent a replacement for sugar',
    'Do laboratory tests to identify diseases',
  ],
  A: [
    'Write books or plays',
    'Play a musical instrument',
    'Compose or arrange music',
    'Draw pictures',
    'Create special effects for movies',
    'Paint sets for plays',
    'Write scripts for movies or television shows',
    'Perform jazz or tap dance',
    'Sing in a band',
    'Edit movies',
  ],
  S: [
    'Teach an individual an exercise routine',
    'Help people with personal or emotional problems',
    'Give career guidance to people',
    'Perform rehabilitation therapy',
    'Do volunteer work at a non-profit organization',
    'Teach children how to play sports',
    'Teach sign language to people who are deaf or hard of hearing',
    'Help conduct a group therapy session',
    'Take care of children at a day-care center',
    'Teach a high-school class',
  ],
  E: [
    'Buy and sell stocks and bonds',
    'Manage a retail store',
    'Operate a beauty salon or barber shop',
    'Manage a department within a large company',
    'Start your own business',
    'Negotiate business contracts',
    'Represent a client in a lawsuit',
    'Market a new line of clothing',
    'Sell merchandise at a department store',
    'Manage a clothing store',
  ],
  C: [
    'Develop a spreadsheet using computer software',
    'Proofread records or forms',
    'Install software across computers on a large network',
    'Operate a calculator',
    'Keep shipping and receiving records',
    'Calculate the wages of employees',
    'Inventory supplies using a hand-held computer',
    'Record rent payments',
    'Keep inventory records',
    'Stamp, sort, and distribute mail for an organization',
  ],
};

describe('O*NET IP Short Form instrument', () => {
  it('validates against the Instrument contract (60 items, 10 per area, anchors 0–4)', () => {
    expect(Instrument.safeParse(ONET_IPSF).success).toBe(true);
  });

  it.each(Object.keys(EXPECTED))(
    'area %s items are verbatim and in paper order (column 1 rows 1–5, then column 2)',
    (area) => {
      const items = ONET_IPSF.items.filter((i) => i.area === area);
      expect(items.map((i) => i.text)).toEqual(EXPECTED[area]);
      expect(items.map((i) => i.id)).toEqual(
        Array.from({ length: 10 }, (_, k) => `${area}${k + 1}`),
      );
      expect(items.map((i) => `${i.paper.column}.${i.paper.row}`)).toEqual([
        '1.1',
        '1.2',
        '1.3',
        '1.4',
        '1.5',
        '2.1',
        '2.2',
        '2.3',
        '2.4',
        '2.5',
      ]);
    },
  );

  it('uses the official anchors, scored 0–4', () => {
    expect(ONET_IPSF.anchors).toEqual([
      { value: 0, label: 'Strongly dislike' },
      { value: 1, label: 'Dislike' },
      { value: 2, label: 'Unsure' },
      { value: 3, label: 'Like' },
      { value: 4, label: 'Strongly like' },
    ]);
  });

  it('carries the revised Social item wording (2018 report, not the older "hearing disabilities")', () => {
    expect(ONET_IPSF.items.map((i) => i.text)).not.toContain(
      'Teach sign language to people with hearing disabilities',
    );
  });

  describe('presentation order (D-026, interim until O*NET Web Services order)', () => {
    const order = ONET_IPSF.presentationOrder.itemIds;

    it('is interleaved R-I-A-S-E-C in paper order', () => {
      expect(ONET_IPSF.presentationOrder.basis).toBe('interleaved-paper-order');
      expect(order.slice(0, 12)).toEqual([
        'R1',
        'I1',
        'A1',
        'S1',
        'E1',
        'C1',
        'R2',
        'I2',
        'A2',
        'S2',
        'E2',
        'C2',
      ]);
      expect(order.slice(-6)).toEqual(['R10', 'I10', 'A10', 'S10', 'E10', 'C10']);
    });

    it('gives every market day items from at least five areas (no day hints at one area, 02 §4.5)', () => {
      for (let day = 0; day < 6; day++) {
        const areas = new Set(order.slice(day * 10, day * 10 + 10).map((id) => id[0]));
        expect(areas.size).toBeGreaterThanOrEqual(5);
      }
    });
  });

  it('records source and the notices the O*NET Tools Developer License requires (D-031)', () => {
    expect(ONET_IPSF.licence).toBe('O*NET Tools Developer License');
    expect(ONET_IPSF.source.url).toBe(
      'https://www.onetcenter.org/dl_tools/ipsf/Interest_Profiler.pdf',
    );
    expect(ONET_IPSF.attribution).toContain(
      'USDOL/ETA has not approved, endorsed, or tested these modifications.',
    );
    expect(ONET_IPSF.attribution).toContain(
      'Margwise has modified all or some of this information.',
    );
    expect(ONET_IPSF.modificationNote).toContain(
      'USDOL/ETA will not be liable to any third party or end-user',
    );
  });
});
