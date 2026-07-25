// Ignite: a seed at the centre and a filled region that grows outward and STAYS
// — the "activating" state (an eSIM coming online, a service switching on).
//
// The distinction from `waiting`/sonar is the whole point: sonar's rings expand
// and FADE, leaving nothing behind, which reads as repeated polling. Here the
// fill persists, so the mode reads as territory being claimed — something
// becoming active rather than something being asked repeatedly.
//
// A flat concentric disc rather than a sphere, so the growth reads radially and
// the silhouette differs from the lattice modes. Unlit dots stay drawn (dark,
// opaque) so the mark is never empty and growth reads against a visible whole.

import { clamp01, radiusScale } from './core';
import type { ModeBuild } from './types';

export const buildIgnite: ModeBuild = (out, size, t, o, progress) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.88);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const rings = Math.max(2, Math.round(o.rings ?? 7));
  const ringDots = Math.max(3, Math.round(o.ringDots ?? 26));
  const spin = t * (o.spin ?? 0.1);

  // how far out the activation has reached, 0–1 of the disc radius
  let fill: number;
  if (progress === undefined) {
    const cyc = (t / (o.period ?? 2.8)) % 1;
    fill = Math.min(1, cyc / (1 - (o.holdFrac ?? 0.26)));
  } else {
    fill = clamp01(progress);
  }

  const front = o.frontWidth ?? 0.16;

  for (let ri = 0; ri < rings; ri++) {
    const f = rings > 1 ? ri / (rings - 1) : 0;
    const rad = f;
    // dots per ring scale with radius so spacing stays even outward
    const n = Math.max(3, Math.round(ringDots * Math.max(0.22, rad)));
    // alternate rings counter-offset so the disc doesn't read as spokes
    const off = spin * (ri % 2 === 0 ? 1 : -1) + ri * 0.5;

    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + off;
      const lit = rad <= fill ? 1 : 0;
      // the propagation front: a bright edge just at the boundary
      const d = (rad - fill) / front;
      const edge = Math.exp(-d * d);

      const hot = Math.max(lit * 0.85, edge);
      out.add(
        cx + Math.cos(a) * rad * R,
        cy + Math.sin(a) * rad * R,
        hot > 0.5 ? 1 : 0,
        ((o.rBase ?? 1.2) + (o.rHot ?? 0.7) * hot) * rs,
        // unlit territory is dark but present, not translucent
        (o.inkCold ?? 0.68) - (o.inkCold ?? 0.68 - 0.08) * hot,
        o.dotA ?? 0.95
      );
    }
  }

  // the seed, always alight
  out.add(cx, cy, 2, ((o.rSeed ?? 1.7) + (o.rPulse ?? 0.5) * (1 - fill)) * rs, 0.06, 1);
};
