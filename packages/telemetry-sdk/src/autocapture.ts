import { ControlId, type Scene } from '@margwise/contracts';
import type { z } from 'zod';
import type { EventInput } from './telemetry.ts';

export interface AutoCaptureOptions {
  /** Usually `document`. */
  root: Document;
  track: (event: EventInput) => unknown;
  scene: () => z.infer<typeof Scene> | undefined;
  /** Lets the navigation tracker pause screen time while the app is hidden. */
  onVisibility?: (visible: boolean) => void;
}

/**
 * Automatic interaction capture (D-027). Listens to exactly two things:
 * `click` on elements carrying a valid `data-track` control id, and
 * `visibilitychange`. It never reads input values, keystrokes, coordinates,
 * hover, scroll or pointer movement (rule 6). Returns a detach function.
 */
export function attachAutoCapture({
  root,
  track,
  scene,
  onVisibility,
}: AutoCaptureOptions): () => void {
  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest('[data-track]');
    const current = scene();
    if (!el || current === undefined) return;
    const control = ControlId.safeParse(el.getAttribute('data-track'));
    if (control.success)
      track({ type: 'control_activated', scene: current, control: control.data });
  };
  const onVisibilityChange = () => {
    const visible = root.visibilityState === 'visible';
    track({ type: 'app_visibility', state: visible ? 'visible' : 'hidden' });
    onVisibility?.(visible);
  };

  root.addEventListener('click', onClick, { capture: true });
  root.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    root.removeEventListener('click', onClick, { capture: true });
    root.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
