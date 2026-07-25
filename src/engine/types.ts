// Engine-level contracts shared by every mode implementation.
//
// Modes build GEOMETRY, not pixels: no ctx, no theme, no colour. That keeps
// the engine zero-DOM so a React Native Skia renderer can consume the same
// buffers as the canvas one. The split was clean because no painter ever read
// `dark` during geometry — it only reached the old `paint()` call.

import type { DotBuffer } from './buffer';
import type { ModeOpts } from './profiles';

export type { Dot } from './core';

/**
 * One frame of geometry: fills `out` for a mode at CSS-px `size` and time `t`.
 *
 * `progress` is 0–1 for determinate states and `undefined` when the state
 * should loop on the clock. Only the modes in `PROGRESS_MODES` read it; the
 * rest ignore it. It's a positional param rather than an entry in `opts`
 * because `opts` is memoised per (state, size) in the `resolvePreset` cache —
 * a per-frame value can't live there without mutating shared state or copying
 * the object on every frame of the hot path.
 */
export type ModeBuild = (
  out: DotBuffer,
  size: number,
  t: number,
  opts: ModeOpts,
  progress?: number
) => void;
