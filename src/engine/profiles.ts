// Density profiles + the multiplier machinery that scales them. The base
// rows are inkform's `fine` profiles; each shipped preset (state × size)
// applies count / radius multipliers on top, resolved once per mount.

export interface ModeOpts {
  [key: string]: number | undefined;
}

// 2-D lattices (rings × dots-per-ring) come in pairs — each side takes
// √scale so the TOTAL dot count scales by `scale`; flat lists scale
// linearly. `iconD` sets the morph outline's sampling density.
const COUNT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['latRings', 'lonDensity'],
  ['rings', 'lonDensity'],
  ['lanes', 'segs'],
  ['cols', 'rows'],
  ['shellRings', 'shellN']
];
const COUNT_KEYS = [
  'orbitN',
  'ghostN',
  'arcN',
  'ringDots',
  'nodeN',
  'partN',
  'dotN',
  'coreN',
  'coil',
  'rungDots'
] as const;
const ICON_DENSITY_KEYS = ['iconD'] as const;

// Every key that sets a dot's rendered radius — scaling all of them keeps
// a dot's near/far falloff intact while shrinking or growing the mark.
//
// NOTE: a new mode's radius/count opt names MUST be registered here (and in
// COUNT_* above), or the preset `count`/`size` multipliers silently skip them
// and size interpolation looks broken for that one mode.
const RADIUS_KEYS = [
  'rBase',
  'rDepth',
  'rActive',
  'rDot',
  'ghostR',
  'partR',
  'partRDepth',
  'rArc',
  'rHead',
  'rEnd',
  'rCore',
  'rPulse',
  'rTaper',
  'rNode',
  'rGlow',
  'rTravel',
  'rShell',
  'rPart',
  'rHot',
  'rEdge',
  'rEdgeHot',
  'rRung',
  'rWinner',
  'rFlash'
] as const;

export function scaleCounts(opts: ModeOpts, scale: number): ModeOpts {
  const out: ModeOpts = { ...opts };
  const done = new Set<string>();
  const rt = Math.sqrt(scale);
  for (const [a, b] of COUNT_PAIRS) {
    const va = out[a];
    const vb = out[b];
    if (va != null && vb != null && !done.has(a) && !done.has(b)) {
      out[a] = Math.max(2, Math.round(va * rt));
      out[b] = Math.max(2, Math.round(vb * rt));
      done.add(a);
      done.add(b);
    }
  }
  for (const k of COUNT_KEYS) {
    const v = out[k];
    if (v != null && !done.has(k)) out[k] = Math.max(1, Math.round(v * scale));
  }
  for (const k of ICON_DENSITY_KEYS) {
    const v = out[k];
    if (v != null) out[k] = Math.max(0.02, v * scale);
  }
  return out;
}

export function scaleRadii(opts: ModeOpts, scale: number): ModeOpts {
  const out: ModeOpts = { ...opts };
  for (const k of RADIUS_KEYS) {
    const v = out[k];
    if (v != null) out[k] = v * scale;
  }
  // remember the multiplier itself — spacing-derived radii (the morph
  // outline) use it, since they aren't based on any single radius key
  out.rSizeMul = (out.rSizeMul ?? 1) * scale;
  return out;
}

/** Base (fine) profiles per mode, before preset multipliers. */
export const BASE_PROFILES: Record<string, ModeOpts> = {
  globe: {
    latRings: 17,
    lonDensity: 44,
    rBase: 0.6,
    rDepth: 1.7,
    rBoost: 1.0,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3
  },
  orbits: {
    orbitN: 12,
    ghostN: 40,
    ghostR: 0.9,
    ghostA: 0.5,
    particles: 3,
    partR: 1.2,
    partRDepth: 1.6,
    rsPow: 0.6,
    rMin: 0.3
  },
  rubik: {
    latRings: 15,
    lonDensity: 40,
    moveCount: 14,
    rBase: 0.6,
    rDepth: 1.7,
    rActive: 0.3,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3
  },
  wave: {
    rings: 15,
    lonDensity: 40,
    rBase: 0.6,
    rDepth: 1.7,
    rsPow: 0.6,
    rMin: 0.3
  },
  ribbon: {
    lanes: 5,
    segs: 88,
    ghostN: 150,
    rBase: 1.1,
    rDepth: 1.7,
    rsPow: 0.6,
    rMin: 0.3
  },
  morph: {
    rDot: 0.021,
    iconD: 1,
    rMin: 0.25
  },
  route: {
    latRings: 17,
    lonDensity: 44,
    arcN: 26,
    pool: 24,
    rBase: 0.6,
    rDepth: 1.7,
    rArc: 1.25,
    rHead: 1.9,
    rEnd: 2.4,
    inkFar: 0.66,
    inkSpan: 0.42,
    inkArc: 0.1,
    dimBase: 0.55,
    trailA: 1,
    headWidth: 0.16,
    lift: 0.09,
    rsPow: 0.6,
    rMin: 0.3
  },
  sonar: {
    ringN: 4,
    ringDots: 34,
    reach: 0.9,
    period: 1.6,
    spin: 0.25,
    rBase: 2.3,
    rTaper: 1.0,
    rCore: 2.3,
    rPulse: 1.1,
    inkNear: 0.08,
    inkSpan: 0.5,
    ringA: 1,
    fade: 0.3,
    rsPow: 0.6,
    rMin: 0.3
  },
  graph: {
    nodeN: 22,
    edgeN: 5,
    edgeSeg: 5,
    trail: 4,
    spin: 0.16,
    cometLen: 0.32,
    rNode: 1.35,
    rDepth: 1.1,
    rGlow: 1.9,
    rTravel: 1.6,
    rEdge: 0.5,
    rEdgeHot: 0.5,
    inkNode: 0.5,
    inkGlow: 0.44,
    inkEdge: 0.66,
    inkEdgeHot: 0.3,
    nodeA: 0.92,
    edgeA: 0.85,
    rsPow: 0.6,
    rMin: 0.3
  },
  funnel: {
    partN: 60,
    shellN: 22,
    shellRings: 7,
    waist: 0.16,
    spin: 0.2,
    flowRate: 0.5,
    rShell: 0.85,
    rDepth: 1.5,
    rPart: 1.45,
    rHot: 0.6,
    inkShell: 0.66,
    inkPart: 0.2,
    shellA: 0.88,
    rsPow: 0.6,
    rMin: 0.3
  },
  raster: {
    cols: 12,
    rows: 12,
    inset: 0.13,
    period: 1.35,
    band: 1.4,
    cursorRate: 4.2,
    rBase: 1.6,
    rActive: 1.7,
    inkAhead: 0.62,
    inkRead: 0.36,
    inkActive: 0.06,
    baseA: 0.9,
    rsPow: 0.6,
    rMin: 0.3
  },
  vortex: {
    partN: 130,
    coreN: 12,
    arms: 3,
    armJitter: 0.14,
    turns: 2.2,
    tilt: 1.15,
    disk: 0.18,
    spin: 0.14,
    flowRate: 0.34,
    rPart: 0.95,
    rDepth: 1.6,
    rHot: 0.7,
    rCore: 1.1,
    inkFar: 0.66,
    inkSpan: 0.5,
    inkCore: 0.16,
    partA: 0.95,
    rsPow: 0.6,
    rMin: 0.3
  },
  helix: {
    coil: 54,
    pitch: 2.6,
    spin: 1.15,
    tilt: 0.22,
    taper: 0.45,
    rungEvery: 5,
    rungDots: 3,
    rBase: 1.05,
    rDepth: 1.7,
    rRung: 0.7,
    inkFar: 0.66,
    inkSpan: 0.54,
    inkRung: 0.66,
    strandA: 1,
    rungA: 0.9,
    rsPow: 0.6,
    rMin: 0.3
  },
  cluster: {
    dotN: 150,
    groups: 3,
    spread: 0.62,
    spin: 0.2,
    rBase: 0.7,
    rDepth: 1.7,
    rWinner: 0.8,
    inkFar: 0.66,
    inkSpan: 0.54,
    inkWinner: 0.22,
    dotA: 0.95,
    rsPow: 0.6,
    rMin: 0.3
  },
  cascade: {
    cols: 16,
    rows: 10,
    inset: 0.12,
    ragged: 0.42,
    period: 2.6,
    holdFrac: 0.38,
    rBase: 2.1,
    rHead: 1.6,
    inkWritten: 0.5,
    inkHead: 0.06,
    dotA: 0.95,
    rsPow: 0.6,
    rMin: 0.3
  },
  fault: {
    dotN: 44,
    reach: 0.5,
    blast: 0.7,
    arm: 0.8,
    spin: 0.35,
    rBase: 0.9,
    rDepth: 1.6,
    rX: 2.05,
    inkFar: 0.66,
    inkSpan: 0.54,
    inkX: 0.1,
    dotA: 1,
    rsPow: 0.6,
    rMin: 0.3
  },
  shatter: {
    dotN: 190,
    reach: 0.44,
    blast: 0.95,
    settle: 1,
    fall: 0,
    spin: 0.18,
    farK: 0.45,
    rBase: 1.0,
    rDepth: 1.7,
    rFlash: 0.7,
    inkFar: 0.66,
    inkSpan: 0.54,
    inkOut: 0.2,
    dotA: 1,
    rsPow: 0.6,
    rMin: 0.3
  }
};
