// The canvas 2D renderer.
//
// The only DOM-aware part of the drawing path. The engine emits a DotBuffer of
// pure geometry; this turns it into pixels. A React Native Skia renderer would
// be a sibling of this file consuming the same buffer.
//
// Plain circle fills only — no ctx.filter, no SVG filters, no WebGL — so the
// output is identical in Chrome, Safari and Firefox.

import { A_LEVELS, L_LEVELS, type RampLut, styleFor } from '../color';
import type { DotBuffer } from '../engine/buffer';

export interface RenderOpts {
  /** Minimum dot radius in px, so small orbs stay legible. */
  rMin?: number;
  /** Global alpha multiplier — drives state crossfades. */
  fade?: number;
  /**
   * Coalesce same-style dots into one path with a single fill. Cuts fill calls
   * ~10x, but circles sharing a path UNION rather than double-darkening, so
   * overlapping semi-transparent dots composite differently. Off by default.
   */
  batchPaths?: boolean;
}

/**
 * Paint a buffer.
 *
 * Dots are walked in z-order and `fillStyle` is only reassigned when the
 * quantised (ink, alpha) bucket changes. Because z-sorted dots have smoothly
 * varying depth, identical buckets arrive in long runs — this is what turns
 * 566 style writes per frame into a few dozen.
 */
export function renderCanvas2D(
  ctx: CanvasRenderingContext2D,
  buf: DotBuffer,
  lut: RampLut,
  dark: boolean,
  opts: RenderOpts = {}
): void {
  const rMin = opts.rMin ?? 0.3;
  const fade = opts.fade ?? 1;
  if (fade <= 0) return;

  buf.sortByZ();
  const { dots, order, n } = buf;

  const batch = opts.batchPaths ?? false;
  let curStyle = '';
  let open = false;

  for (let i = 0; i < n; i++) {
    const d = dots[order[i]];

    const alpha = (d.a ?? 1) * fade;
    if (alpha < 0.02) continue;

    // Upstream mapped ink straight to an sRGB grey level, mirroring on dark
    // substrates so near dots read bright. That grey level is now the ramp
    // index, which is why `mono` reproduces upstream exactly.
    const w = d.white < 0 ? 0 : d.white > 1 ? 1 : d.white;
    const ink = dark ? 1 - w : w;

    const lB = (ink * (L_LEVELS - 1) + 0.5) | 0;
    const aB = ((alpha > 1 ? 1 : alpha) * (A_LEVELS - 1) + 0.5) | 0;
    const style = styleFor(lut, lB, aB);

    const r = d.r < rMin ? rMin : d.r;

    if (style !== curStyle) {
      if (batch && open) ctx.fill();
      curStyle = style;
      ctx.fillStyle = style;
      if (batch) {
        ctx.beginPath();
        open = true;
      }
    }

    if (batch) {
      // arcs in one path must not be joined by an implicit line
      ctx.moveTo(d.x + r, d.y);
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    } else {
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (batch && open) ctx.fill();
}
