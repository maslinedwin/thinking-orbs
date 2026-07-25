// The shipped tunings, and the machinery that resolves ANY size from them.
//
// Upstream shipped exactly two sizes (20, 64) as separate hand-tuned designs
// and typed `size` as `64 | 20`. Those tunings are the real intellectual
// content of the library, so they stay authoritative — but they're now
// ANCHORS that arbitrary sizes interpolate between, rather than the only two
// legal values. (Upstream's own demo worked around the limit by rendering
// size 64 and CSS-scaling it to 56px.)

import { shatterCycle } from './engine/burst';
import type { ModeOpts } from './engine/profiles';
import { BASE_PROFILES, scaleCounts, scaleRadii } from './engine/profiles';
import type { OrbState } from './types';

export type ModeKey =
  | 'orbits'
  | 'globe'
  | 'rubik'
  | 'wave'
  | 'ribbon'
  | 'morph'
  | 'route'
  | 'sonar'
  | 'graph'
  | 'funnel'
  | 'raster'
  | 'vortex'
  | 'helix'
  | 'cluster'
  | 'cascade'
  | 'shatter';

/**
 * Modes that read the `progress` prop. Everything else ignores it — the
 * workbench uses this to decide when to show the progress slider, and
 * `ThinkingOrb` uses it to warn in dev if `progress` is passed to a state
 * that can't express it.
 */
export const PROGRESS_MODES: ReadonlySet<ModeKey> = new Set<ModeKey>([
  'funnel',
  'raster',
  'vortex',
  'cascade'
]);

interface Preset {
  speed: number;
  count: number;
  size: number;
  /** Extra mode opts merged verbatim after scaling. */
  extra?: ModeOpts;
}

interface StatePreset {
  mode: ModeKey;
  /** Natural cycle length in scaled time units — only needed for `once`. */
  cycle?: number;
  /** Tuning at the 20px anchor. */
  a20: Preset;
  /** Tuning at the 64px anchor. */
  a64: Preset;
}

// rubik's cycle is 2 * moveCount * slotDur + rest, with slotDur 0.42, rest 1.2
const rubikCycle = (moveCount: number) => 2 * moveCount * 0.42 + 1.2;

const STATES: Record<OrbState, StatePreset> = {
  // --- the six upstream states, tunings unchanged --------------------
  working: {
    mode: 'orbits',
    a64: { speed: 1.885, count: 1, size: 1 },
    a20: { speed: 3.9, count: 0.238, size: 2.4 }
  },
  searching: {
    mode: 'globe',
    a64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    a20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } }
  },
  solving: {
    mode: 'rubik',
    a64: { speed: 1.82, count: 0.35, size: 1.05 },
    a20: { speed: 1.95, count: 0.088, size: 1.9 }
  },
  listening: {
    mode: 'wave',
    a64: { speed: 4.388, count: 0.341, size: 1 },
    a20: { speed: 3.998, count: 0.105, size: 1.6 }
  },
  composing: {
    mode: 'ribbon',
    a64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    a20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } }
  },
  shaping: {
    mode: 'morph',
    a64: { speed: 2.405, count: 0.54, size: 0.395, extra: { spread: 1.45 } },
    a20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } }
  },

  // --- new states: re-tuned existing modes, no new painters ----------
  // First-pass values, meant to be dialled in the demo workbench and baked.

  /** Slow low-contrast breathing — the agent is present but not busy. */
  idle: {
    mode: 'globe',
    a64: { speed: 0.55, count: 0.42, size: 1.15, extra: { scanMul: 1.5, dimBase: 0.82 } },
    a20: { speed: 0.72, count: 0.105, size: 1.75, extra: { scanMul: 1.6, dimBase: 0.82 } }
  },

  /** Tighter, faster scan than `searching` — reading something closely. */
  analyzing: {
    mode: 'globe',
    a64: { speed: 2.85, count: 0.55, size: 1.1, extra: { scanMul: 6.1, dimBase: 0.32 } },
    a20: { speed: 3.1, count: 0.13, size: 1.7, extra: { scanMul: 6.4, dimBase: 0.32 } }
  },

  /** Fewer, slower, decisive turns — reads as locking something in. */
  booking: {
    mode: 'rubik',
    a64: { speed: 1.05, count: 0.35, size: 1.05, extra: { moveCount: 6 } },
    a20: { speed: 1.18, count: 0.088, size: 1.9, extra: { moveCount: 6 } }
  },

  /**
   * Ribbon with the 3D tumble unfrozen and a deeper wave — continuous flow.
   *
   * The small anchor damps `spin` and widens the band: at 20px a full tumble
   * swings the ribbon edge-on, and with only ~200 dots that instant reads as a
   * sparse crescent rather than a flowing band.
   */
  streaming: {
    mode: 'ribbon',
    a64: { speed: 2.6, count: 0.25, size: 0.85, extra: { spin: 1, bandMul: 3.2, wobMul: 1.35 } },
    a20: { speed: 3.35, count: 0.075, size: 1.073, extra: { spin: 0.4, bandMul: 5.2, wobMul: 1.1 } }
  },

  /** One-shot: scrambles then clicks back solved and holds. Pair with `once`. */
  success: {
    mode: 'rubik',
    cycle: rubikCycle(5),
    a64: { speed: 1.6, count: 0.35, size: 1.05, extra: { moveCount: 5 } },
    a20: { speed: 1.7, count: 0.088, size: 1.9, extra: { moveCount: 5 } }
  },

  // --- batch 1: new engine modes -------------------------------------
  // First-pass tunings, meant to be dialled in the workbench and baked.

  /** A great-circle arc traces between two points over a held-back globe. */
  connecting: {
    mode: 'route',
    // dimBase is alpha on the globe lattice, so it dominates this mode's
    // perceived weight. At 0.22 the orb measured 0.42x the ink of the other
    // states and read as a faint smudge next to them.
    a64: { speed: 0.62, count: 0.42, size: 1.15, extra: { dimBase: 0.52, lift: 0.09 } },
    // 20px: the globe recedes a little further so the arc still separates, but
    // not so far that the mark hollows out
    a20: { speed: 0.72, count: 0.115, size: 1.7, extra: { dimBase: 0.44, lift: 0.13 } }
  },

  /** Concentric rings expand outward and fade — pinging, awaiting a reply. */
  waiting: {
    mode: 'sonar',
    a64: { speed: 1.0, count: 1.55, size: 1, extra: { ringN: 4, rTaper: 1.0 } },
    a20: { speed: 1.05, count: 0.5, size: 1.7, extra: { ringN: 3, rTaper: 0.8 } }
  },

  /** An activation hops node→node across a constellation — chain of thought. */
  reasoning: {
    mode: 'graph',
    a64: { speed: 1.55, count: 1.25, size: 1, extra: { trail: 4, edgeN: 5, edgeSeg: 7 } },
    // fewer nodes but bigger, or 20px turns into indistinct grey speckle
    a20: { speed: 1.5, count: 0.6, size: 1.9, extra: { trail: 3, edgeN: 4, edgeSeg: 3 } }
  },

  /** Dots fall through an hourglass waist and pile up. Accepts `progress`. */
  queuing: {
    mode: 'funnel',
    a64: { speed: 1.0, count: 1, size: 1, extra: { waist: 0.16, shellRings: 7, shellN: 22 } },
    // the shell is explicitly thinned at this anchor: sqrt-scaling
    // shellRings×shellN left the silhouette eating ~70% of the small anchor's
    // dot budget, crowding out the particles that carry the actual motion
    a20: {
      speed: 1.1,
      count: 0.26,
      size: 1.65,
      extra: { waist: 0.22, shellRings: 5, shellN: 7 }
    }
  },

  /** Flat lattice with a row-by-row sweep. Accepts `progress`. */
  reading: {
    mode: 'raster',
    a64: { speed: 1.0, count: 1, size: 1, extra: { band: 1.4, inset: 0.13 } },
    a20: { speed: 1.05, count: 0.25, size: 1.7, extra: { band: 1.1, inset: 0.1 } }
  },

  // --- batch 2: new engine modes -------------------------------------

  /** Dots spiral inward and accrete at the core. Accepts `progress`. */
  gathering: {
    mode: 'vortex',
    a64: { speed: 1.15, count: 1, size: 1, extra: { turns: 2.2, disk: 0.18, arms: 3, tilt: 1.15 } },
    // fewer turns at 20px — a tight spiral there just reads as a blurred ring
    a20: {
      speed: 1.3,
      count: 0.3,
      size: 1.9,
      extra: { turns: 1.6, disk: 0.22, arms: 2, tilt: 1.05 }
    }
  },

  /** Two counter-rotating strands with rungs — two things staying in step. */
  syncing: {
    mode: 'helix',
    a64: { speed: 1.0, count: 1.15, size: 1, extra: { pitch: 2.6, rungEvery: 5, taper: 0.45 } },
    a20: { speed: 1.1, count: 0.3, size: 1.85, extra: { pitch: 1.7, rungEvery: 4, taper: 0.3 } }
  },

  /** A field splits into groups, one wins, then re-merges. */
  comparing: {
    mode: 'cluster',
    a64: { speed: 1.0, count: 1, size: 1, extra: { groups: 3, spread: 0.62 } },
    a20: { speed: 1.05, count: 0.24, size: 1.85, extra: { groups: 3, spread: 0.55 } }
  },

  /** Dots fill in line by line with ragged edges. Accepts `progress`. */
  drafting: {
    mode: 'cascade',
    a64: { speed: 1.0, count: 1.35, size: 1, extra: { ragged: 0.42, inset: 0.12 } },
    a20: { speed: 1.05, count: 0.38, size: 1.8, extra: { ragged: 0.34, inset: 0.1 } }
  },

  /** Bursts outward, hangs, then snaps back together — retry and recover. */
  retrying: {
    mode: 'shatter',
    a64: {
      speed: 1.0,
      count: 1,
      size: 1,
      extra: { blast: 0.95, settle: 1, farK: 0.45, reach: 0.44, fall: 0 }
    },
    a20: {
      speed: 1.05,
      count: 0.16,
      size: 1.8,
      extra: { blast: 0.8, settle: 1, farK: 0.5, reach: 0.46, fall: 0 }
    }
  },

  /**
   * One-shot: bursts and never reassembles. `settle: 0` is what makes this a
   * distinct state rather than a re-tuning — no preset twiddling on an existing
   * mode can express "and then it stays broken". Pair with `once`.
   */
  error: {
    mode: 'shatter',
    cycle: shatterCycle(0),
    a64: {
      speed: 1.25,
      count: 1,
      size: 1,
      extra: { blast: 0.6, settle: 0, farK: 0.8, reach: 0.44, fall: 0.85, inkOut: 0.34 }
    },
    a20: {
      speed: 1.3,
      count: 0.16,
      size: 1.8,
      extra: { blast: 0.5, settle: 0, farK: 0.85, reach: 0.46, fall: 0.7, inkOut: 0.34 }
    }
  }
};

/**
 * The raw anchor table. Exposed for tests and tooling — in particular the test
 * that asserts both anchors of a state declare the SAME `extra` keys, which
 * `lerpExtra` below depends on.
 */
export const STATE_ANCHORS: Readonly<Record<OrbState, StatePreset>> = STATES;

export const STATE_TO_MODE = Object.fromEntries(
  Object.entries(STATES).map(([k, v]) => [k, v.mode])
) as Record<OrbState, ModeKey>;

export const ORB_STATES = Object.keys(STATES) as OrbState[];

// --- size resolution ---------------------------------------------------

const A_LO = 20;
const A_HI = 64;
const LN_LO = Math.log(A_LO);
const LN_SPAN = Math.log(A_HI) - LN_LO;

/** Hard bounds. */
export const MIN_SIZE = 12;
export const MAX_SIZE = 256;
/** Outside this we still render, but warn in dev — extrapolation gets shaky. */
const TRUST_LO = 16;
const TRUST_HI = 128;
/** Ceiling on the log-lerp parameter used for dot COUNT only. t=1 is size 64. */
const COUNT_T_MAX = 1.6;

const logLerp = (a: number, b: number, t: number) =>
  Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

/**
 * Interpolate the `extra` opts between the two anchors.
 *
 * IMPORTANT: a key present at only ONE anchor is treated as constant across all
 * sizes — it CANNOT fall back to the base profile, because that value has
 * already been count/radius-scaled by the time we get here and re-deriving it
 * would undo that scaling. So a 20px-only override silently applies at 64px
 * too, which is a genuinely easy mistake to make (it cost `queuing@64` 85 dots
 * during development). Declare every `extra` key at BOTH anchors; the
 * "anchors declare symmetric extra keys" test enforces it.
 */
function lerpExtra(
  a: ModeOpts | undefined,
  b: ModeOpts | undefined,
  t: number
): ModeOpts | undefined {
  if (!a && !b) return undefined;
  const out: ModeOpts = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const va = a?.[k];
    const vb = b?.[k];
    if (va == null) out[k] = vb;
    else if (vb == null) out[k] = va;
    // LINEAR, not log: `spin` and `dimBase` are 0 or equal at both anchors,
    // and log-lerping through 0 gives -Infinity.
    else out[k] = va + (vb - va) * t;
  }
  return out;
}

export interface Resolved {
  mode: ModeKey;
  speed: number;
  opts: ModeOpts;
  /** Natural cycle length, if the state declares one (for `once`). */
  cycle?: number;
}

// Keys are bounded in practice (states × integer sizes) but no longer at 12
// like upstream, so the cache is capped rather than growing without limit.
const cache = new Map<string, Resolved>();
const CACHE_MAX = 96;

let warnedRange = false;

/** Resolve a (state, size) pair to its mode + fully-scaled draw options. */
export function resolvePreset(state: OrbState, size: number): Resolved {
  const sp = STATES[state] ?? STATES.working;

  // Runtime guard: upstream threw `TypeError: Cannot read properties of
  // undefined (reading 'count')` for any size other than 20 or 64, which any
  // JS caller or bad prop hit immediately.
  let s = size;
  if (!Number.isFinite(s) || s <= 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[@nowah/orbs] invalid size ${String(size)}; falling back to 64`);
    }
    s = 64;
  }
  s = Math.round(Math.max(MIN_SIZE, Math.min(MAX_SIZE, s)));
  if (process.env.NODE_ENV !== 'production' && !warnedRange && (s < TRUST_LO || s > TRUST_HI)) {
    warnedRange = true;
    console.warn(
      `[@nowah/orbs] size ${s} is outside the tuned range ${TRUST_LO}-${TRUST_HI}; ` +
        'presets are extrapolated and may not read well.'
    );
  }

  const key = `${state}-${s}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // log space, because the anchor tunings are multiplicative ratios
  const t = (Math.log(s) - LN_LO) / LN_SPAN;
  const { a20, a64 } = sp;
  const speed = logLerp(a20.speed, a64.speed, t);
  // Dot COUNT is capped above the 64 anchor. Extrapolating it freely tracks
  // area, so working@256 resolved to 14,784 dots/frame — ~890k arcs/sec at
  // 60fps. Past the top anchor the mark should grow mostly by getting bigger
  // dots, not exponentially more of them, so radius extrapolates freely and
  // count flattens out.
  const count = logLerp(a20.count, a64.count, Math.min(t, COUNT_T_MAX));
  const rsize = logLerp(a20.size, a64.size, t);
  const extra = lerpExtra(a20.extra, a64.extra, t);

  let opts: ModeOpts = { ...BASE_PROFILES[sp.mode] };
  if (count !== 1) opts = scaleCounts(opts, count);
  if (rsize !== 1) opts = scaleRadii(opts, rsize);
  if (extra) opts = { ...opts, ...extra };

  const resolved: Resolved = { mode: sp.mode, speed, opts, cycle: sp.cycle };
  if (cache.size >= CACHE_MAX) {
    // cheap FIFO eviction — insertion order is iteration order
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, resolved);
  return resolved;
}
