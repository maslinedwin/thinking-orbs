// The native ThinkingOrb.
//
// Everything meaningful is shared with web: the engine, the 29 presets, size
// interpolation, the colour ramps, and the single shared rAF driver (which
// needed no changes — React Native provides requestAnimationFrame and
// performance.now).
//
// What differs, and why:
//
// - Rendering goes through render/skia.ts instead of canvas2d.ts.
// - The Picture reaches Skia through a plain mutable holder plus an imperative
//   `redraw()`, so building a frame does NOT re-render React. Holding it in state
//   would be fine for one orb and ruinous for a list of them. Skia's
//   `AnimatedProp<T>` is `T | { value: T }`, which is the documented escape
//   hatch for this and means no Reanimated dependency.
// - `AppState` replaces `visibilitychange`.
// - There is NO offscreen pause. The web shell uses IntersectionObserver; RN has
//   no cheap equivalent, so an orb scrolled out of view keeps animating. For a
//   long list, pass `paused` yourself based on viewability.
// - No device-pixel-ratio handling: Skia works in dp and scales itself.

import {
  Canvas,
  createPicture,
  Picture,
  Skia,
  type SkPicture,
  useCanvasRef
} from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import { AppState, type StyleProp, View, type ViewStyle } from 'react-native';
import { getLut } from '../color';
import { sharedClock, subscribe as subscribeFrames } from '../driver';
import { DotBuffer } from '../engine/buffer';
import { MODE_BUILDS } from '../engine/registry';
import { PROGRESS_MODES, resolvePreset } from '../presets';
import { renderSkia } from '../render/skia';
import type { OrbState, OrbTheme, Palette, PaletteName, Ramp } from '../types';
import { useReducedMotion, useResolvedDark } from './theme';

export interface ThinkingOrbNativeProps {
  /** Which animation to show. @default 'working' */
  state?: OrbState;
  /** Size in dp (12–256). 20 and 64 are the tuned anchors. @default 64 */
  size?: number;
  /** `auto` follows the system colour scheme. @default 'auto' */
  theme?: OrbTheme;
  /** @default 'green' */
  palette?: PaletteName | Palette;
  /** Custom ramp, overriding `palette`. */
  ramp?: Ramp;
  /** Multiplier on the preset's baked speed. @default 1 */
  speed?: number;
  /** Freeze on the current frame. @default false */
  paused?: boolean;
  /** Play one cycle and hold — states declaring a natural cycle only. */
  once?: boolean;
  /** Determinate progress 0–1; only `PROGRESS_MODES` states express it. */
  progress?: number;
  /** Cross-fade ms on state change; 0 for a hard cut. @default 300 */
  crossfade?: number;
  style?: StyleProp<ViewStyle>;
  /** Overrides the per-state default. */
  accessibilityLabel?: string;
}

const LABELS: Record<string, string> = {
  working: 'Working',
  searching: 'Searching',
  solving: 'Solving',
  listening: 'Listening',
  composing: 'Composing',
  shaping: 'Shaping',
  idle: 'Idle',
  analyzing: 'Analysing',
  booking: 'Booking',
  streaming: 'Streaming',
  success: 'Done',
  connecting: 'Connecting',
  waiting: 'Waiting',
  reasoning: 'Reasoning',
  queuing: 'Queued',
  reading: 'Reading',
  gathering: 'Gathering',
  syncing: 'Syncing',
  comparing: 'Comparing',
  drafting: 'Drafting',
  retrying: 'Retrying',
  error: 'Something went wrong',
  committing: 'Confirming',
  progressing: 'In progress',
  monitoring: 'Monitoring',
  diverting: 'Finding an alternative',
  verifying: 'Verifying',
  activating: 'Activating',
  plotting: 'Plotting'
};

export function ThinkingOrb({
  state = 'working',
  size = 64,
  theme = 'auto',
  palette = 'green',
  ramp,
  speed = 1,
  paused = false,
  once = false,
  progress,
  crossfade = 300,
  style,
  accessibilityLabel
}: ThinkingOrbNativeProps) {
  const dark = useResolvedDark(theme);
  const reduced = useReducedMotion();
  const canvasRef = useCanvasRef();

  // Skia's `AnimatedProp<T>` accepts `T | { value: T }`, so a plain mutable
  // holder is enough — no Reanimated dependency. Mutating `.value` and calling
  // `redraw()` repaints without React re-rendering, which matters because a
  // list of orbs setting state 60x a second would be ruinous. Seeded with an
  // empty picture so the prop is never null.
  const picture = useRef<{ value: SkPicture }>({ value: createPicture(() => {}) });

  if (__DEV__ && progress !== undefined) {
    const { mode } = resolvePreset(state, size);
    if (!PROGRESS_MODES.has(mode)) {
      console.warn(
        `[@nowah/orbs] state "${state}" (mode "${mode}") ignores \`progress\`; ` +
          `states backed by ${Array.from(PROGRESS_MODES).join(', ')} express it.`
      );
    }
  }

  // Mutable props live in a ref so changing them doesn't restart the loop.
  const live = useRef({ state, speed, paused, once, crossfade, palette, ramp, dark, progress });
  live.current = { state, speed, paused, once, crossfade, palette, ramp, dark, progress };

  const clock = useRef({ t: 0, seeded: false });
  const prev = useRef<{ state: OrbState; t: number; mix: number } | null>(null);
  const lastState = useRef(state);
  const bufA = useRef(new DotBuffer());
  const bufB = useRef(new DotBuffer());

  if (lastState.current !== state) {
    if (crossfade > 0) prev.current = { state: lastState.current, t: clock.current.t, mix: 1 };
    lastState.current = state;
  }

  useEffect(() => {
    if (!clock.current.seeded) {
      // seed from the shared clock so equal-speed orbs stay in phase
      clock.current.t = sharedClock();
      clock.current.seeded = true;
    }

    const bounds = Skia.XYWHRect(0, 0, size, size);

    const paint = () => {
      const l = live.current;
      const lut = getLut(l.palette, l.dark, l.ramp);

      picture.current.value = createPicture((canvas) => {
        const out = prev.current;
        if (out && out.mix > 0) {
          const pOut = resolvePreset(out.state, size);
          const b = bufB.current;
          b.reset();
          MODE_BUILDS[pOut.mode](b, size, out.t * pOut.speed, pOut.opts, l.progress);
          renderSkia(Skia, canvas, b, lut, l.dark, {
            rMin: pOut.opts.rMin,
            fade: out.mix
          });
        }

        const p = resolvePreset(l.state, size);
        const a = bufA.current;
        a.reset();
        let t = clock.current.t;
        if (l.once && p.cycle !== undefined) t = Math.min(t, p.cycle / p.speed);
        MODE_BUILDS[p.mode](a, size, t * p.speed, p.opts, l.progress);
        renderSkia(Skia, canvas, a, lut, l.dark, {
          rMin: p.opts.rMin,
          fade: out ? 1 - out.mix : 1
        });
      }, bounds);

      canvasRef.current?.redraw();
    };

    // reduced motion → one static, deterministic frame
    if (reduced) {
      clock.current.t = 0.6;
      prev.current = null;
      paint();
      return;
    }

    let unsub: (() => void) | null = null;
    const tick = (dt: number) => {
      const l = live.current;
      if (!l.paused) {
        clock.current.t += dt * l.speed;
        const out = prev.current;
        if (out) {
          out.t += dt * l.speed;
          out.mix -= dt * (1000 / Math.max(1, l.crossfade));
          if (out.mix <= 0) prev.current = null;
        }
      }
      paint();
    };
    const start = () => {
      if (!unsub) unsub = subscribeFrames(tick);
    };
    const stop = () => {
      unsub?.();
      unsub = null;
    };

    paint();
    start();

    // stop burning frames while backgrounded
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') start();
      else stop();
    });

    return () => {
      stop();
      appSub.remove();
    };
  }, [size, reduced, canvasRef]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? LABELS[state] ?? 'Loading'}
      style={[{ width: size, height: size }, style]}
    >
      <Canvas ref={canvasRef} style={{ width: size, height: size }}>
        <Picture picture={picture.current} />
      </Canvas>
    </View>
  );
}
