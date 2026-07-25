// Vigil: a dim field with one sentinel slowly circling it, pulsing at intervals
// — the "monitoring" state.
//
// This state exists because travel has waits measured in DAYS, not seconds: a
// price alert runs for months, and a compensation claim sits at
// `awaiting_response` for weeks. Every other state in the set animates at a
// "something is happening right now" tempo. Here the tempo IS the design — it's
// deliberately the slowest thing shipped, and it should read as dormant but
// alive rather than busy.
//
// `idle` is not the same thing: idle means not working, this means watching.

import { fibDir, makeProj, radiusScale } from './core';
import type { ModeBuild } from './types';

export const buildVigil: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.82);
  const pt = makeProj(t * (o.spin ?? 0.07), 0.36, cx, cy, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const fieldN = Math.max(8, Math.round(o.fieldN ?? 128));

  // the sentinel's position on its slow orbit
  const orbit = t * (o.orbit ?? 0.55);
  const sx = Math.cos(orbit);
  const sz = Math.sin(orbit);
  const sy = o.orbitY ?? 0.18;

  // a periodic heartbeat: a ripple crosses the field outward from the sentinel
  const beat = (t / (o.beatEvery ?? 3.2)) % 1;
  const ripple = beat * (o.rippleReach ?? 2.6);

  for (let i = 0; i < fieldN; i++) {
    const d = fibDir(i, fieldN);
    const [px, py, z] = pt(d[0], d[1], d[2]);
    const depth = (z + 1) / 2;

    // angular distance from the sentinel, used to time the ripple
    const dot = d[0] * sx + d[1] * sy + d[2] * sz;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
    const wave = Math.exp(-(((ang - ripple) / (o.rippleWidth ?? 0.42)) ** 2));

    out.add(
      px,
      py,
      z,
      ((o.rField ?? 0.6) + (o.rDepth ?? 1.5) * depth + (o.rWave ?? 0.8) * wave) * rs,
      // the field sits well back via ink and brightens only as the beat passes
      (o.inkFar ?? 0.74) - (o.inkSpan ?? 0.3) * depth - (o.inkWave ?? 0.34) * wave,
      o.fieldA ?? 0.92
    );
  }

  // the sentinel itself, plus a short trail so its direction reads
  const trail = Math.max(1, Math.round(o.trail ?? 5));
  for (let k = 0; k < trail; k++) {
    const a = orbit - k * (o.trailGap ?? 0.14);
    const [px, py, z] = pt(Math.cos(a) * 1.04, sy, Math.sin(a) * 1.04);
    const depth = (z + 1) / 2;
    const fade = 1 - k / trail;
    out.add(
      px,
      py,
      z + 0.02,
      ((o.rSentinel ?? 1.5) + (o.rDepth ?? 1.5) * depth) * fade * rs,
      0.08 + 0.3 * (1 - fade),
      fade
    );
  }
};
