// Sonar: concentric rings expand outward from the centre and fade — the
// "waiting" state. Reads as pinging something and waiting for an answer.
//
// The first flat mode: every dot sits at z = 0, so there's no depth to shade.
// Ink and radius are driven by the ring's age instead — freshly emitted rings
// are bright and tight, old ones are faint and wide. Dots per ring scale with
// the ring's radius so spacing stays even as it grows, which is what stops a
// large ring reading as a dotted line with gaps.

import { radiusScale } from './core';
import type { ModeBuild } from './types';

export const buildSonar: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = (size / 2) * (o.reach ?? 0.9);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const ringN = Math.max(1, Math.round(o.ringN ?? 4));
  // dots at FULL radius; each ring takes its share by radius fraction
  const ringDots = Math.max(4, Math.round(o.ringDots ?? 34));
  const spin = t * (o.spin ?? 0.25);

  for (let k = 0; k < ringN; k++) {
    // rings evenly staggered through one expansion cycle
    const frac = (t / (o.period ?? 1.6) + k / ringN) % 1;

    const r = maxR * frac;
    if (r < 0.5) continue;

    // Fade in fast off the centre, then hold most of the way out. Ageing is
    // carried mainly by INK — the ring darkens as it expands — with only a
    // light alpha taper. Driving the age with alpha made every outer ring
    // translucent and the whole mode read as a faint wisp beside the sphere
    // modes, which keep alpha high and recede via the ramp.
    const fadeIn = Math.min(1, frac / 0.1);
    const alpha = (o.ringA ?? 1) * fadeIn * (1 - (o.fade ?? 0.3) * frac);
    if (alpha < 0.03) continue;

    // keep a floor of dots on young rings so they read as a ring, not a dyad
    const n = Math.max(6, Math.round(ringDots * (0.34 + 0.66 * frac)));
    // counter-rotate alternate rings so the pattern never looks like spokes
    const off = spin * (k % 2 === 0 ? 1 : -1) + k * 0.7;

    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + off;
      out.add(
        cx + Math.cos(ang) * r,
        cy + Math.sin(ang) * r,
        // slight z stagger keeps the painter's coalescing runs long
        k * 0.001,
        ((o.rBase ?? 2.3) - (o.rTaper ?? 1.0) * frac) * rs,
        (o.inkNear ?? 0.08) + (o.inkSpan ?? 0.5) * frac,
        alpha
      );
    }
  }

  // the emitter at the centre, pulsing once per ring
  const pulse = 1 - ((t / (o.period ?? 1.6)) % (1 / ringN)) * ringN;
  out.add(cx, cy, 1, ((o.rCore ?? 1.8) + (o.rPulse ?? 0.9) * pulse) * rs, 0.06, 1);
};
