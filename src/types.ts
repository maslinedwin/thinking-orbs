import type { CanvasHTMLAttributes, CSSProperties } from 'react';
import type { Palette, PaletteName, Ramp } from './color';

/**
 * The shipped states.
 *
 * The six originals — each a hand-tuned animation:
 * - `working`   — particles on tilted orbits
 * - `searching` — a scan meridian sweeps a dotted globe
 * - `solving`   — bands scramble in quarter turns, then click back
 * - `listening` — a waveform rolls through latitude rings
 * - `composing` — an undulating multi-band sash
 * - `shaping`   — a dotted outline morphs circle → triangle → square
 *
 * Plus re-tuned variants of the same modes:
 * - `idle`      — slow low-contrast breathing
 * - `analyzing` — a tighter, faster scan than `searching`
 * - `booking`   — fewer, slower, decisive turns; reads as locking in
 * - `streaming` — continuous directional flow
 * - `success`   — one-shot; scrambles then clicks back solved (pair with `once`)
 *
 * And five on modes of their own:
 * - `connecting` — a great-circle arc traces between two points on a globe
 * - `waiting`    — concentric rings expand outward and fade
 * - `reasoning`  — an activation hops node→node across a constellation
 * - `queuing`    — dots fall through an hourglass waist (accepts `progress`)
 * - `reading`    — a flat lattice sweeps row by row (accepts `progress`)
 */
export type OrbState =
  | 'working'
  | 'searching'
  | 'solving'
  | 'listening'
  | 'composing'
  | 'shaping'
  | 'idle'
  | 'analyzing'
  | 'booking'
  | 'streaming'
  | 'success'
  | 'connecting'
  | 'waiting'
  | 'reasoning'
  | 'queuing'
  | 'reading';

/**
 * Rendered size in CSS pixels. Any value in 12–256 works; 20 and 64 are the
 * hand-tuned anchors and everything else interpolates between them in log
 * space. Sizes outside 16–128 render but warn in dev, since the tunings are
 * extrapolated there.
 */
export type OrbSize = number;

/**
 * Theme mode.
 *
 * - `auto` (default) resolves in three layers, live-updating on change:
 *   1. a `data-theme="dark|light"` attribute or `dark`/`light` class on
 *      any ancestor (the Tailwind / shadcn convention), watched via a single
 *      shared `MutationObserver`;
 *   2. otherwise `matchMedia('(prefers-color-scheme: dark)')`,
 *      subscribed for live OS/browser theme switches;
 *   3. during SSR (no DOM) the theme resolves on the first client render,
 *      before anything is painted — the canvas is client-only.
 * - `dark` / `light` pin the palette regardless of context.
 *
 * Dark selects the palette's dark ramp (bright ink for dark backgrounds);
 * light selects its light ramp.
 */
export type OrbTheme = 'auto' | 'dark' | 'light';

export type { Palette, PaletteName, Ramp, Stop } from './color';

/** Props for the ThinkingOrb React component. */
export interface ThinkingOrbProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'style'> {
  /** Which animation to show. @default 'working' */
  state?: OrbState;

  /** Size in CSS px (12–256). 20 and 64 are the tuned anchors. @default 64 */
  size?: OrbSize;

  /** Theme mode; `auto` detects from the host project. @default 'auto' */
  theme?: OrbTheme;

  /**
   * Colour ramp. `green` is Nowah's brand jade, `mono` reproduces the original
   * grayscale, `twoTone` puts green highlights on a neutral base.
   * @default 'green'
   */
  palette?: PaletteName | Palette;

  /**
   * Custom ramp, overriding `palette`. Stops are indexed by the ink level they
   * replace: `at: 0` is the darkest ink, `at: 1` the brightest.
   */
  ramp?: Ramp;

  /**
   * Animation speed multiplier on top of the preset's baked speed. Changing it
   * alters the rate from that moment on; it does not shift the phase.
   * @default 1
   */
  speed?: number;

  /** Freeze the animation, holding the current frame. @default false */
  paused?: boolean;

  /**
   * Play one cycle and hold the final frame instead of looping. Only states
   * that declare a natural cycle (`success`) support this; others ignore it.
   * @default false
   */
  once?: boolean;

  /**
   * Determinate progress, 0–1. Omit for an indeterminate loop.
   *
   * Only states whose mode is in `PROGRESS_MODES` express it — `queuing` maps
   * it to the pile height, `reading` to the sweep position. Passing it to any
   * other state is ignored (and warns in dev). Values out of range clamp.
   */
  progress?: number;

  /**
   * Cross-fade duration in ms when `state` changes. 0 disables (hard cut, the
   * original behaviour). @default 300
   */
  crossfade?: number;

  /**
   * Coalesce same-colour dots into one path with a single fill. Faster, but
   * overlapping semi-transparent dots union instead of double-darkening, so
   * the look changes subtly. @default false
   */
  batchPaths?: boolean;

  style?: CSSProperties;
}
