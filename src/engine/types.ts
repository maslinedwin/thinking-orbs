// Engine-level contracts shared by every mode implementation.
//
// Modes build GEOMETRY, not pixels: no ctx, no theme, no colour. That keeps
// the engine zero-DOM so a React Native Skia renderer can consume the same
// buffers as the canvas one. The split was clean because no painter ever read
// `dark` during geometry — it only reached the old `paint()` call.

import type { DotBuffer } from './buffer';
import type { ModeOpts } from './profiles';

export type { Dot } from './core';

/** One frame of geometry: fills `out` for a mode at CSS-px `size` and time `t`. */
export type ModeBuild = (out: DotBuffer, size: number, t: number, opts: ModeOpts) => void;
