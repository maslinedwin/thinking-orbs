// Route: a great-circle arc traces between two points on a dimmed globe —
// the "connecting" state. Nowah's signature orb: it's a flight path.
//
// The globe lattice is reused from core (`latLonLattice`, same field as the
// globe/rubik/wave modes) but dimmed hard, because the whole read depends on
// the arc being unmistakably brighter than the sphere behind it. At the 20px
// anchor there are only ~55 lattice dots and ~14 arc dots, so an
// insufficiently dimmed globe swallows the arc entirely.

import { fibDir, latLonLattice, makeProj, radiusScale, slerp, smoothE } from './core';
import type { ModeBuild } from './types';

/** One leg per cycle: fly, hold, pick a new pair. */
const FLY = 0.74;

export const buildRoute: ModeBuild = (out, size, t, o) => {
  const spin = 0.34;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.82;
  const tilt = 0.42 + 0.05 * Math.sin(t * 0.3);
  const pt = makeProj(t * spin, tilt, cx, cy, radius);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const dimBase = o.dimBase ?? 0.55;

  // --- the globe, held back as a substrate ---------------------------
  // Held back by INK, not by alpha. Pushing recession into alpha makes dots
  // translucent, which reads as a washed-out mark rather than a solid one —
  // the sphere modes all keep alpha high and let the ramp do the receding.
  latLonLattice(o.latRings ?? 17, o.lonDensity ?? 44, (ux, uy, uz) => {
    const [px, py, z] = pt(ux, uy, uz);
    const depth = (z + 1) / 2;
    out.add(
      px,
      py,
      z,
      ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth) * rs,
      (o.inkFar ?? 0.66) - (o.inkSpan ?? 0.42) * depth,
      dimBase
    );
  });

  // --- pick this cycle's endpoints -----------------------------------
  // Deterministic from the cycle index, so the route changes between legs
  // without any per-instance state. `pool` spreads candidates evenly over the
  // sphere; picking i and i+stride keeps pairs a decent arc apart rather than
  // occasionally adjacent (a 3px arc reads as a smudge, not a path).
  const cycle = Math.floor(t);
  const localT = t - cycle;
  const pool = Math.max(6, Math.round(o.pool ?? 24));
  const a = fibDir(cycle % pool, pool);
  const b = fibDir((cycle * 7 + Math.floor(pool / 3)) % pool, pool);

  // --- the arc -------------------------------------------------------
  const arcN = Math.max(4, Math.round(o.arcN ?? 26));
  // eased fly, then a hold at the far end before the next pair
  const travel = localT < FLY ? smoothE(localT / FLY) : 1;
  const headWidth = o.headWidth ?? 0.16;
  const rEnd = (o.rEnd ?? 2.1) * rs;

  for (let i = 0; i < arcN; i++) {
    const f = i / (arcN - 1);
    const [ux, uy, uz] = slerp(a, b, f);
    // lift the arc off the surface so it reads as a path over the globe, not
    // a line drawn on it
    const lift = 1 + (o.lift ?? 0.09) * Math.sin(f * Math.PI);
    const [px, py, z] = pt(ux * lift, uy * lift, uz * lift);
    const depth = (z + 1) / 2;

    // dots the traveller has passed stay lit; ahead of it they're unlit
    const laid = f <= travel ? 1 : 0;
    // a moving head brightens and swells the dots around it
    const d = (f - travel) / headWidth;
    const head = Math.exp(-d * d);

    const on = Math.max(laid * (o.trailA ?? 1), head);
    if (on < 0.03) continue;

    // the arc separates from the globe by being BIGGER and BRIGHTER, not by
    // the globe being faint
    out.add(
      px,
      py,
      z,
      ((o.rArc ?? 1.25) + (o.rDepth ?? 1.7) * depth + (o.rHead ?? 1.9) * head) * rs,
      (o.inkArc ?? 0.1) - 0.08 * depth - 0.06 * head,
      on
    );
  }

  // --- endpoint markers ----------------------------------------------
  for (const [ux, uy, uz] of [a, b]) {
    const [px, py, z] = pt(ux, uy, uz);
    // the destination pulses once the traveller lands
    const isDest = uz === b[2] && ux === b[0];
    const landed = isDest && travel >= 1 ? 1 + 0.25 * Math.sin(t * 12) : 1;
    out.add(px, py, z + 0.01, rEnd * landed, 0.08, 1);
  }
};
