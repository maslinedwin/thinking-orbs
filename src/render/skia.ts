// The React Native Skia renderer.
//
// Sibling of render/canvas2d.ts, consuming the exact same DotBuffer. The engine,
// the presets and the colour ramps are shared untouched — this file and
// native/ThinkingOrb.tsx are the whole native surface.
//
// Two things differ from the web renderer:
//
// 1. Colour. `SkColor` is a Float32Array of unpremultiplied RGBA floats, so the
//    LUT's `rgb` bytes convert directly with no string building. That's why
//    color.ts keeps `rgb: Uint8Array` separate from the web-only `rgba()`
//    strings — this was the payoff.
// 2. Paints are cached per (ink, alpha) bucket rather than mutated. A Picture
//    records draw calls, and mutating one shared Paint between drawCircle calls
//    risks the recording seeing the final state for every dot. Cached paints are
//    bounded by the LUT (64 x 32) and reused across frames, so the allocation
//    rate is still zero in the steady state.
//
// No device-pixel-ratio maths here: Skia's canvas is already in dp and handles
// scaling itself, whereas the web renderer has to size a backing store.

import type { SkCanvas, Skia as SkiaApi, SkPaint } from '@shopify/react-native-skia';
import { A_LEVELS, L_LEVELS, type RampLut } from '../color';
import type { DotBuffer } from '../engine/buffer';

export interface SkiaRenderOpts {
  /** Minimum dot radius in dp, so small orbs stay legible. */
  rMin?: number;
  /** Global alpha multiplier — drives state crossfades. */
  fade?: number;
}

/** Paint cache per LUT, keyed by bucket index. */
const paintCache = new WeakMap<RampLut, Map<number, SkPaint>>();

function paintFor(Skia: typeof SkiaApi, lut: RampLut, lBucket: number, aBucket: number): SkPaint {
  let byLut = paintCache.get(lut);
  if (!byLut) {
    byLut = new Map();
    paintCache.set(lut, byLut);
  }
  const key = lBucket * A_LEVELS + aBucket;
  const hit = byLut.get(key);
  if (hit) return hit;

  const o = lBucket * 3;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  // SkColor is unpremultiplied RGBA in 0..1
  paint.setColor(
    new Float32Array([
      lut.rgb[o] / 255,
      lut.rgb[o + 1] / 255,
      lut.rgb[o + 2] / 255,
      aBucket / (A_LEVELS - 1)
    ]) as unknown as Parameters<SkPaint['setColor']>[0]
  );
  byLut.set(key, paint);
  return paint;
}

/**
 * Paint a buffer into a Skia canvas.
 *
 * Walks in z-order like the web renderer, so overlap is identical. There's no
 * fillStyle-coalescing equivalent to do here — `drawCircle` takes its paint per
 * call, and the paints are already cached — but quantising to the same buckets
 * keeps the two renderers' output matched.
 */
export function renderSkia(
  Skia: typeof SkiaApi,
  canvas: SkCanvas,
  buf: DotBuffer,
  lut: RampLut,
  dark: boolean,
  opts: SkiaRenderOpts = {}
): void {
  const rMin = opts.rMin ?? 0.3;
  const fade = opts.fade ?? 1;
  if (fade <= 0) return;

  buf.sortByZ();
  const { dots, order, n } = buf;

  for (let i = 0; i < n; i++) {
    const d = dots[order[i]];

    const alpha = (d.a ?? 1) * fade;
    if (alpha < 0.02) continue;

    // identical ink mapping to canvas2d: the ramp is indexed by the grey level
    // it replaces, mirrored on dark substrates
    const w = d.white < 0 ? 0 : d.white > 1 ? 1 : d.white;
    const ink = dark ? 1 - w : w;

    const lB = (ink * (L_LEVELS - 1) + 0.5) | 0;
    const aB = ((alpha > 1 ? 1 : alpha) * (A_LEVELS - 1) + 0.5) | 0;

    canvas.drawCircle(d.x, d.y, d.r < rMin ? rMin : d.r, paintFor(Skia, lut, lB, aB));
  }
}
