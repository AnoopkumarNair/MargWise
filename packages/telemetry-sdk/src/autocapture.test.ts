// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  attachAutoCapture,
  createNavigationTracker,
  createTelemetry,
  MemoryQueueStore,
  type EventInput,
  type Telemetry,
} from './index.ts';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

const SESSION = '0b9f2a3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';

/** Captures what the app would track, without the queue/transport. */
function recorder() {
  const tracked: EventInput[] = [];
  return { tracked, track: (e: EventInput) => (tracked.push(e), 'queued' as const) };
}

describe('createNavigationTracker — screen-level time and navigation path', () => {
  let now = 0;
  const clock = () => now;
  beforeEach(() => {
    now = 0;
  });

  it('emits scene_entered on the first screen without a navigated event', () => {
    const rec = recorder();
    createNavigationTracker({ track: rec.track, clock }).enter('welcome');
    expect(rec.tracked).toEqual([{ type: 'scene_entered', scene: 'welcome' }]);
  });

  it('on navigation emits scene_exited with time on screen, navigated, then scene_entered', () => {
    const rec = recorder();
    const nav = createNavigationTracker({ track: rec.track, clock });
    nav.enter('welcome');
    now = 4_000;
    nav.enter('consent', 'tap');
    expect(rec.tracked.slice(1)).toEqual([
      { type: 'scene_exited', scene: 'welcome', durationMs: 4_000 },
      { type: 'navigated', from: 'welcome', to: 'consent', via: 'tap' },
      { type: 'scene_entered', scene: 'consent' },
    ]);
  });

  it('excludes time while the app is hidden from time on screen', () => {
    const rec = recorder();
    const nav = createNavigationTracker({ track: rec.track, clock });
    nav.enter('dossier');
    now = 1_000;
    nav.setVisible(false);
    now = 61_000;
    nav.setVisible(true);
    now = 62_000;
    nav.enter('isles_map', 'back');
    expect(rec.tracked).toContainEqual({
      type: 'scene_exited',
      scene: 'dossier',
      durationMs: 2_000,
    });
  });

  it('re-entering the same scene is a no-op (no zero-length screens)', () => {
    const rec = recorder();
    const nav = createNavigationTracker({ track: rec.track, clock });
    nav.enter('market_day');
    nav.enter('market_day');
    expect(rec.tracked).toHaveLength(1);
  });

  it('closing a screen while the app is hidden counts only the visible part', () => {
    const rec = recorder();
    const nav = createNavigationTracker({ track: rec.track, clock });
    nav.enter('voyage_chart');
    now = 3_000;
    nav.setVisible(false);
    now = 90_000;
    nav.end();
    expect(rec.tracked.at(-1)).toEqual({
      type: 'scene_exited',
      scene: 'voyage_chart',
      durationMs: 3_000,
    });
  });

  it('a repeated "visible" signal does not restart the timer', () => {
    const rec = recorder();
    const nav = createNavigationTracker({ track: rec.track, clock });
    nav.enter('hall');
    now = 2_000;
    nav.setVisible(true);
    now = 5_000;
    nav.enter('dossier', 'tap');
    expect(rec.tracked).toContainEqual({ type: 'scene_exited', scene: 'hall', durationMs: 5_000 });
  });

  it('clamps durations so a phone left open for days or a clock going backwards cannot break navigation', () => {
    const rec = recorder();
    const nav = createNavigationTracker({ track: rec.track, clock });
    nav.enter('hall');
    now = 3 * 24 * 60 * 60 * 1000;
    nav.enter('dossier', 'tap');
    now = 0;
    nav.enter('isles_map', 'back');
    expect(rec.tracked).toContainEqual({
      type: 'scene_exited',
      scene: 'hall',
      durationMs: 86_400_000,
    });
    expect(rec.tracked).toContainEqual({ type: 'scene_exited', scene: 'dossier', durationMs: 0 });
    expect(nav.current()).toBe('isles_map');
  });

  it('end() closes the current screen', () => {
    const rec = recorder();
    const nav = createNavigationTracker({ track: rec.track, clock });
    nav.enter('logbook');
    now = 500;
    nav.end();
    expect(rec.tracked.at(-1)).toEqual({ type: 'scene_exited', scene: 'logbook', durationMs: 500 });
    expect(nav.current()).toBeUndefined();
  });
});

describe('attachAutoCapture — taps on named controls and app visibility, nothing else', () => {
  let detach: () => void;
  let rec: ReturnType<typeof recorder>;
  let visibility: boolean[];

  beforeEach(() => {
    document.body.innerHTML = `
      <button data-track="dial.like"><span id="inner">Like</span></button>
      <a href="#" data-track="Ravi Kumar">bad id</a>
      <button id="untracked">no id</button>
      <input id="name-field" value="secret typed text" />`;
    rec = recorder();
    visibility = [];
    detach = attachAutoCapture({
      root: document,
      track: rec.track,
      scene: () => 'market_day',
      onVisibility: (v) => visibility.push(v),
    });
  });
  afterEach(() => detach());

  it('records control_activated for an element (or its child) with a valid data-track id', () => {
    byId('inner').click();
    expect(rec.tracked).toEqual([
      { type: 'control_activated', scene: 'market_day', control: 'dial.like' },
    ]);
  });

  it('ignores elements without data-track and invalid ids (free text can never become a control id)', () => {
    byId('untracked').click();
    (document.querySelector('[data-track="Ravi Kumar"]') as HTMLElement).click();
    expect(rec.tracked).toEqual([]);
  });

  it('never reads input values or keystrokes', () => {
    const input = document.getElementById('name-field') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.click();
    expect(JSON.stringify(rec.tracked)).not.toContain('secret');
    expect(rec.tracked).toEqual([]);
  });

  it('does not listen to pointer movement (no hover, dwell or cursor tracking)', () => {
    for (const type of ['mousemove', 'pointermove', 'mouseover', 'scroll', 'wheel']) {
      document.body.dispatchEvent(new Event(type, { bubbles: true }));
    }
    expect(rec.tracked).toEqual([]);
  });

  it('records app_visibility on visibilitychange and notifies the navigation tracker', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rec.tracked).toEqual([{ type: 'app_visibility', state: 'hidden' }]);
    expect(visibility).toEqual([false]);
  });

  it('ignores taps before any scene is shown', () => {
    detach();
    detach = attachAutoCapture({ root: document, track: rec.track, scene: () => undefined });
    byId('inner').click();
    expect(rec.tracked).toEqual([]);
  });

  it('works without a visibility callback', () => {
    detach();
    detach = attachAutoCapture({ root: document, track: rec.track, scene: () => 'hall' });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rec.tracked).toEqual([{ type: 'app_visibility', state: 'visible' }]);
  });

  it('detach removes every listener', () => {
    detach();
    byId('inner').click();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rec.tracked).toEqual([]);
  });
});

describe('actor', () => {
  let telemetry: Telemetry;
  let sent: Array<{ path: string; body: unknown }>;

  beforeEach(async () => {
    sent = [];
    let id = 0;
    telemetry = createTelemetry({
      sessionId: SESSION,
      config: { minorsTelemetryEnabled: true, batchSize: 100 },
      transport: { post: async (path, body) => (sent.push({ path, body }), { status: 202 }) },
      store: new MemoryQueueStore(),
      clock: () => 0,
      uuid: () => `00000000-0000-4000-8000-${String(id++).padStart(12, '0')}`,
    });
    await telemetry.setConsent({
      tier: 1,
      noticeVersion: 'v',
      teenAssent: false,
      deletionCodeHash: 'f'.repeat(64),
    });
  });

  it('exposes the current actor', () => {
    expect(telemetry.actor).toBe('teen');
    telemetry.setActor('family');
    expect(telemetry.actor).toBe('family');
  });

  it('defaults to teen, stamps every event, and emits actor_changed on hand-off', async () => {
    telemetry.track({ type: 'reveal_viewed' });
    telemetry.setActor('patron');
    telemetry.track({ type: 'reveal_viewed' });
    telemetry.setActor('patron');
    await telemetry.flush();
    const events = (sent[1]?.body as { events: Array<{ type: string; actor: string }> }).events;
    expect(events.map((e) => [e.type, e.actor])).toEqual([
      ['reveal_viewed', 'teen'],
      ['actor_changed', 'patron'],
      ['reveal_viewed', 'patron'],
    ]);
  });
});
