// Helix: two counter-rotating strands with rungs between them — the "syncing"
// state. Reads as two things exchanging, staying in step.
//
// The only mode with a vertical rather than round silhouette, which is most of
// what distinguishes it at a glance. The strands genuinely counter-rotate, so
// they cross and uncross rather than spinning as a rigid body; the rungs are
// what make it read as coupling instead of two unrelated ribbons.

import { makeProj, radiusScale } from './core';
import type { ModeBuild } from './types';

export const buildHelix: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.84;
  // a fixed tilt: the strand crossing already supplies the motion, and adding
  // a tumble on top made the shape unreadable
  const pt = makeProj(0, o.tilt ?? 0.22, cx, cy, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const coil = Math.max(4, Math.round(o.coil ?? 46));
  const pitch = o.pitch ?? 2.6;
  const spin = t * (o.spin ?? 1.15);
  const taper = o.taper ?? 0.45;
  const rBase = o.rBase ?? 0.8;
  const rDepth = o.rDepth ?? 1.7;
  const inkFar = o.inkFar ?? 0.66;
  const inkSpan = o.inkSpan ?? 0.54;

  /** Strand radius at height y — a spindle, widest at the middle. */
  const rad = (y: number) => 1 - taper + taper * Math.cos((y * Math.PI) / 2);

  /** Position of strand `s` at step `k`. */
  const strandAt = (k: number, s: number): [number, number, number] => {
    const y = -1 + (2 * k) / coil;
    // Both strands wind the SAME way, offset by half a turn — that's what a
    // double helix is. Winding them in opposite directions (the literal reading
    // of "counter-rotating") mirrors them about y=0 and reads as a barrel or an
    // X, not a helix. The motion comes from `spin` rotating the whole pair.
    const ang = pitch * Math.PI * y + spin + s * Math.PI;
    const rr = rad(y) * 0.78;
    return [Math.cos(ang) * rr, y * 0.9, Math.sin(ang) * rr];
  };

  for (let s = 0; s < 2; s++) {
    for (let k = 0; k <= coil; k++) {
      const [x, y, z0] = strandAt(k, s);
      const [px, py, z] = pt(x, y, z0);
      const depth = (z + 1) / 2;
      out.add(px, py, z, (rBase + rDepth * depth) * rs, inkFar - inkSpan * depth, o.strandA ?? 1);
    }
  }

  // --- rungs: dotted chains bridging the strands ----------------------
  const every = Math.max(1, Math.round(o.rungEvery ?? 6));
  const rungDots = Math.max(1, Math.round(o.rungDots ?? 3));
  for (let k = 0; k <= coil; k += every) {
    const a = strandAt(k, 0);
    const b = strandAt(k, 1);
    for (let i = 1; i <= rungDots; i++) {
      const f = i / (rungDots + 1);
      const [px, py, z] = pt(
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f
      );
      const depth = (z + 1) / 2;
      out.add(
        px,
        py,
        z,
        ((o.rRung ?? 0.55) + rDepth * depth * 0.5) * rs,
        // rungs sit back from the strands via ink, not translucency
        (o.inkRung ?? 0.66) - 0.26 * depth,
        o.rungA ?? 0.9
      );
    }
  }
};
