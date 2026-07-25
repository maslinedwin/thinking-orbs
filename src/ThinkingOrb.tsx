// The ThinkingOrb component.
//
// Differences from upstream that matter:
//
// - One SHARED rAF loop drives every mounted orb (src/driver.ts), not one loop
//   per instance.
// - Time is accumulated locally from `dt` and seeded from the shared clock at
//   mount. Equal-speed orbs stay in phase, including ones mounted later, but
//   changing `speed` now alters the rate from that moment on. Upstream derived
//   time as `performance.now()/1000 * speed`, so a nudge from 1 → 1.01 after
//   20 minutes of uptime jumped the animation forward 23 seconds.
// - Mutable props live in refs, so changing `speed`/`paused`/`state` no longer
//   tears down the effect and re-inits (and thus clears) the canvas. Only
//   `size` and dpr rebuild the backing store.
// - State changes cross-fade instead of hard-cutting.
//
// Reduced-motion users still get a static representative frame that follows
// the live theme.

import { useEffect, useRef } from 'react';
import { getLut } from './color';
import { sharedClock, subscribe as subscribeFrames } from './driver';
import { DotBuffer } from './engine/buffer';
import { MODE_BUILDS } from './engine/registry';
import { PROGRESS_MODES, resolvePreset } from './presets';
import { renderCanvas2D } from './render/canvas2d';
import { useReducedMotion, useResolvedDark } from './theme';
import type { OrbState, ThinkingOrbProps } from './types';

const LABELS: Record<string, string> = {
  working: 'Working…',
  searching: 'Searching…',
  solving: 'Solving…',
  listening: 'Listening…',
  composing: 'Composing…',
  shaping: 'Shaping…',
  idle: 'Idle',
  analyzing: 'Analysing…',
  booking: 'Booking…',
  streaming: 'Streaming…',
  success: 'Done',
  connecting: 'Connecting…',
  waiting: 'Waiting…',
  reasoning: 'Reasoning…',
  queuing: 'Queued…',
  reading: 'Reading…'
};

/** Live device pixel ratio, capped at 2. */
function currentDpr(): number {
  return Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
}

export function ThinkingOrb({
  state = 'working',
  size = 64,
  theme = 'auto',
  palette = 'green',
  ramp,
  speed = 1,
  paused = false,
  once = false,
  crossfade = 300,
  batchPaths = false,
  progress,
  style,
  'aria-label': ariaLabel,
  ...rest
}: ThinkingOrbProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dark = useResolvedDark(theme, ref);
  const reduced = useReducedMotion();

  if (process.env.NODE_ENV !== 'production' && progress !== undefined) {
    const { mode } = resolvePreset(state, size);
    if (!PROGRESS_MODES.has(mode)) {
      console.warn(
        `[@nowah/orbs] state "${state}" (mode "${mode}") ignores \`progress\`; ` +
          `states backed by ${Array.from(PROGRESS_MODES).join(', ')} express it.`
      );
    }
  }

  // Everything the frame loop reads lives in a ref, so prop changes don't
  // restart the loop or resize (and clear) the canvas.
  const live = useRef({
    state,
    speed,
    paused,
    once,
    crossfade,
    batchPaths,
    palette,
    ramp,
    dark,
    progress
  });
  live.current = {
    state,
    speed,
    paused,
    once,
    crossfade,
    batchPaths,
    palette,
    ramp,
    dark,
    progress
  };

  // Per-instance animation time, and the outgoing state being cross-faded out.
  const clock = useRef({ t: 0, seeded: false });
  const prev = useRef<{ state: OrbState; t: number; mix: number } | null>(null);
  const lastState = useRef(state);

  const bufA = useRef(new DotBuffer());
  const bufB = useRef(new DotBuffer());

  // Detect state changes during render so the crossfade starts on the very
  // next frame rather than a frame late.
  if (lastState.current !== state) {
    if (crossfade > 0) prev.current = { state: lastState.current, t: clock.current.t, mix: 1 };
    lastState.current = state;
  }

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = currentDpr();
    const sizeCanvas = () => {
      dpr = currentDpr();
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    };
    sizeCanvas();

    if (!clock.current.seeded) {
      // seed from the shared clock so equal-speed orbs are in phase even if
      // this one mounted later
      clock.current.t = sharedClock();
      clock.current.seeded = true;
    }

    const paint = () => {
      const l = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const lut = getLut(l.palette, l.dark, l.ramp);

      // outgoing state, fading out
      const out = prev.current;
      if (out && out.mix > 0) {
        const pOut = resolvePreset(out.state, size);
        const b = bufB.current;
        b.reset();
        MODE_BUILDS[pOut.mode](b, size, out.t * pOut.speed, pOut.opts, l.progress);
        renderCanvas2D(ctx, b, lut, l.dark, {
          rMin: pOut.opts.rMin,
          fade: out.mix,
          batchPaths: l.batchPaths
        });
      }

      const p = resolvePreset(l.state, size);
      const a = bufA.current;
      a.reset();
      let t = clock.current.t;
      if (l.once && p.cycle !== undefined) t = Math.min(t, p.cycle / p.speed);
      MODE_BUILDS[p.mode](a, size, t * p.speed, p.opts, l.progress);
      renderCanvas2D(ctx, a, lut, l.dark, {
        rMin: p.opts.rMin,
        fade: out ? 1 - out.mix : 1,
        batchPaths: l.batchPaths
      });
    };

    // reduced motion → one static, deterministic frame
    if (reduced) {
      clock.current.t = 0.6;
      prev.current = null;
      paint();
      return;
    }

    let visible = true;
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
      if (unsub) return;
      unsub = subscribeFrames(tick);
    };
    const stop = () => {
      unsub?.();
      unsub = null;
    };

    // always show something, even while paused or offscreen
    paint();

    // pause offscreen + on hidden tabs — free when not visible
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && document.visibilityState !== 'hidden') start();
            else stop();
          })
        : null;
    io?.observe(canvas);
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop();
      else if (visible) start();
    };
    document.addEventListener('visibilitychange', onVis);
    if (!io) start();

    // redraw at the right backing-store size when the window moves between a
    // Retina and a non-Retina display
    const dprMq =
      typeof matchMedia !== 'undefined' ? matchMedia(`(resolution: ${currentDpr()}dppx)`) : null;
    const onDpr = () => {
      sizeCanvas();
      paint();
    };
    dprMq?.addEventListener('change', onDpr);

    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      dprMq?.removeEventListener('change', onDpr);
    };
  }, [size, reduced]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? LABELS[state]}
      style={{ width: size, height: size, display: 'block', ...style }}
      {...rest}
    />
  );
}
