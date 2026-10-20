import type { Scene } from '@margwise/contracts';
import type { EventInput } from './telemetry.ts';
import type { z } from 'zod';

type SceneId = z.infer<typeof Scene>;
type Via = 'tap' | 'back' | 'swipe' | 'deeplink' | 'auto';

export interface NavigationTrackerOptions {
  track: (event: EventInput) => unknown;
  clock: () => number;
}

/**
 * Screen-level analytics (D-027): time on each screen (visible time only),
 * and the navigation path. No dwell or position inside a screen.
 */
export function createNavigationTracker({ track, clock }: NavigationTrackerOptions) {
  let scene: SceneId | undefined;
  let visibleSince: number | undefined;
  let accumulated = 0;

  const elapsed = () => accumulated + (visibleSince === undefined ? 0 : clock() - visibleSince);

  function exitCurrent() {
    if (scene === undefined) return;
    track({ type: 'scene_exited', scene, durationMs: Math.round(elapsed()) });
  }

  return {
    current: () => scene,
    enter(next: SceneId, via: Via = 'auto') {
      if (next === scene) return;
      const from = scene;
      exitCurrent();
      if (from !== undefined) track({ type: 'navigated', from, to: next, via });
      scene = next;
      accumulated = 0;
      visibleSince = clock();
      track({ type: 'scene_entered', scene: next });
    },
    setVisible(visible: boolean) {
      if (!visible && visibleSince !== undefined) {
        accumulated += clock() - visibleSince;
        visibleSince = undefined;
      } else if (visible && visibleSince === undefined) {
        visibleSince = clock();
      }
    },
    end() {
      exitCurrent();
      scene = undefined;
      visibleSince = undefined;
      accumulated = 0;
    },
  };
}

export type NavigationTracker = ReturnType<typeof createNavigationTracker>;
