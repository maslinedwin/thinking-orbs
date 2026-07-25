// Attest: a segmented ring fills as each item validates — the "verifying" state.
//
// Discrete, item-by-item validation, which is what a document or visa check
// actually is: a list of things each independently confirmed. `reading` (raster)
// is a continuous sweep over a field; this is N separate verdicts, and the gaps
// between segments are what make them read as separate.
//
// Flat (z ≈ 0) so the ring reads square-on. Naturally determinate — a segmented
// ring is a progress bar bent into a circle — so it takes `progress` directly.

import { clamp01, radiusScale } from './core';
import type { ModeBuild } from './types';

export const buildAttest: ModeBuild = (out, size, t, o, progress) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.84);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const segN = Math.max(3, Math.round(o.segN ?? 12));
  const perSeg = Math.max(2, Math.round(o.perSeg ?? 7));
  const gapFrac = o.gapFrac ?? 0.28;

  // how many segments are validated. Indeterminate sweeps round, holds the
  // completed ring, then starts again.
  let done: number;
  if (progress === undefined) {
    const cyc = (t / (o.period ?? 2.6)) % 1;
    done = Math.min(1, cyc / (1 - (o.holdFrac ?? 0.24))) * segN;
  } else {
    done = clamp01(progress) * segN;
  }

  const span = (Math.PI * 2) / segN;
  const arcSpan = span * (1 - gapFrac);
  const ringR = o.ringR ?? 0.88;

  for (let s = 0; s < segN; s++) {
    // 1 = validated, partial = currently being checked, 0 = pending
    const state = Math.max(0, Math.min(1, done - s));
    const checking = state > 0 && state < 1 ? 1 : 0;

    for (let i = 0; i < perSeg; i++) {
      const f = perSeg > 1 ? i / (perSeg - 1) : 0.5;
      // dots within a segment appear left-to-right as it validates, so the
      // check has direction rather than the whole segment popping on
      const on = state >= 1 ? 1 : state > 0 ? (f <= state ? 1 : 0) : 0;
      const a = -Math.PI / 2 + s * span + (f - 0.5) * arcSpan;

      out.add(
        cx + Math.cos(a) * ringR * R,
        cy + Math.sin(a) * ringR * R,
        on > 0 ? 1 : 0,
        ((o.rBase ?? 1.35) + (o.rDone ?? 0.5) * on + (o.rChecking ?? 0.5) * checking * on) * rs,
        // pending segments recede by ink and stay fully opaque, so the ring is
        // always legible as a whole rather than half-vanishing
        (o.inkPending ?? 0.66) - (o.inkPending ?? 0.66 - 0.08) * on,
        o.dotA ?? 0.95
      );
    }
  }

  // a centre mark that only completes once every segment has passed
  const all = done >= segN ? 1 : 0;
  if (all) {
    const tickN = Math.max(2, Math.round(o.tickN ?? 7));
    for (let i = 0; i < tickN; i++) {
      const f = tickN > 1 ? i / (tickN - 1) : 0;
      // a short tick: down-right then up-right
      const x = -0.2 + 0.42 * f;
      const y = f < 0.4 ? -0.06 + 0.5 * f : 0.14 - 0.44 * (f - 0.4);
      out.add(cx + x * R, cy + y * R, 2, (o.rTick ?? 1.3) * rs, 0.08, 1);
    }
  }
};
