import { describe, expect, it, vi } from 'vitest';
import { shatterCycle } from '../engine/burst';
import { faultCycle } from '../engine/fault';
import {
  MAX_SIZE,
  MIN_SIZE,
  ORB_STATES,
  PROGRESS_MODES,
  resolvePreset,
  STATE_ANCHORS
} from '../presets';

const SIX = ['working', 'searching', 'solving', 'listening', 'composing', 'shaping'] as const;

// The upstream hand-tuned speeds. Interpolation must reproduce these EXACTLY
// at the anchors — they're the intellectual content of the library.
const ANCHOR_SPEEDS = {
  working: [3.9, 1.885],
  searching: [2.665, 2.015],
  solving: [1.95, 1.82],
  listening: [3.998, 4.388],
  composing: [3.12, 2.34],
  shaping: [2.08, 2.405]
} as const;

describe('anchor fidelity', () => {
  for (const s of SIX) {
    it(`${s} reproduces the tuned speed at 20 and 64`, () => {
      const [s20, s64] = ANCHOR_SPEEDS[s];
      expect(resolvePreset(s, 20).speed).toBeCloseTo(s20, 10);
      expect(resolvePreset(s, 64).speed).toBeCloseTo(s64, 10);
    });
  }
});

describe('size interpolation', () => {
  it('speed is monotonic in size for every state', () => {
    for (const s of ORB_STATES) {
      const speeds = [16, 20, 24, 32, 40, 48, 56, 64, 96, 128].map(
        (n) => resolvePreset(s, n).speed
      );
      const rising = speeds.every((v, i) => i === 0 || v >= speeds[i - 1]);
      const falling = speeds.every((v, i) => i === 0 || v <= speeds[i - 1]);
      expect(rising || falling, `${s} speed should be monotonic`).toBe(true);
    }
  });

  it('interpolates strictly between the anchors inside 20..64', () => {
    const lo = resolvePreset('working', 20).speed;
    const hi = resolvePreset('working', 64).speed;
    const mid = resolvePreset('working', 40).speed;
    expect(mid).toBeLessThan(lo);
    expect(mid).toBeGreaterThan(hi);
  });

  it('caps dot count growth above the top anchor', () => {
    // free extrapolation put working@256 at 14,784 dots/frame
    const at64 = resolvePreset('working', 64).opts.orbitN as number;
    const at256 = resolvePreset('working', 256).opts.orbitN as number;
    expect(at256).toBeGreaterThan(at64);
    expect(at256 / at64).toBeLessThan(3.5);
  });

  it('linear-lerps extra opts that legitimately hold zero', () => {
    // composing has spin: 0 at BOTH anchors; log-lerping through 0 gives -Inf
    for (const n of [20, 32, 48, 64]) {
      expect(resolvePreset('composing', n).opts.spin).toBe(0);
    }
  });

  it('linear-lerps a non-zero extra opt between differing anchors', () => {
    // streaming damps spin at the small anchor (0.4) and runs a full tumble at
    // the large one (1) — a full tumble at 20px swings the band edge-on
    expect(resolvePreset('streaming', 20).opts.spin).toBeCloseTo(0.4, 10);
    expect(resolvePreset('streaming', 64).opts.spin).toBeCloseTo(1, 10);
    const mid = resolvePreset('streaming', 40).opts.spin as number;
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(1);
  });
});

describe('runtime guards', () => {
  it('does not throw on any size in range', () => {
    for (let n = MIN_SIZE; n <= MAX_SIZE; n += 7) {
      for (const s of ORB_STATES) expect(() => resolvePreset(s, n)).not.toThrow();
    }
  });

  it('falls back instead of throwing on invalid sizes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      // upstream threw TypeError: Cannot read properties of undefined
      expect(() => resolvePreset('working', bad)).not.toThrow();
      expect(resolvePreset('working', bad).speed).toBeCloseTo(
        resolvePreset('working', 64).speed,
        10
      );
    }
    warn.mockRestore();
  });

  it('clamps out-of-range sizes to the hard bounds', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolvePreset('working', 5).speed).toBeCloseTo(
      resolvePreset('working', MIN_SIZE).speed,
      10
    );
    expect(resolvePreset('working', 9999).speed).toBeCloseTo(
      resolvePreset('working', MAX_SIZE).speed,
      10
    );
    warn.mockRestore();
  });

  it('unknown state falls back to working rather than crashing', () => {
    // JS callers can pass anything
    const r = resolvePreset('nonsense' as never, 64);
    expect(r.mode).toBe('orbits');
  });
});

describe('cache', () => {
  it('stays bounded across many distinct sizes', () => {
    // upstream's cache was safe only because keys were bounded at 12; arbitrary
    // sizes would have made it an unbounded leak
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let n = MIN_SIZE; n <= MAX_SIZE; n++) resolvePreset('working', n);
    // resolving again must still be correct after eviction
    expect(resolvePreset('working', 64).speed).toBeCloseTo(1.885, 10);
    warn.mockRestore();
  });

  it('returns equal values for repeated resolves', () => {
    const a = resolvePreset('searching', 37);
    const b = resolvePreset('searching', 37);
    expect(a.speed).toBe(b.speed);
    expect(a.opts).toEqual(b.opts);
  });
});

describe('once support', () => {
  it('only states with a natural cycle declare one', () => {
    expect(resolvePreset('success', 64).cycle).toBeGreaterThan(0);
    expect(resolvePreset('working', 64).cycle).toBeUndefined();
  });
});

describe('anchor hygiene', () => {
  // `lerpExtra` treats a key present at only one anchor as constant across all
  // sizes, so a 20px-only override silently applies at 64px too. That cost
  // `queuing@64` 85 dots during development — this test makes it impossible to
  // reintroduce.
  it('both anchors declare symmetric extra keys', () => {
    for (const state of ORB_STATES) {
      const { a20, a64 } = STATE_ANCHORS[state];
      const k20 = Object.keys(a20.extra ?? {}).sort();
      const k64 = Object.keys(a64.extra ?? {}).sort();
      expect(k20, `${state}: extra keys must match at both anchors`).toEqual(k64);
    }
  });

  it('every state has positive speed, count and size at both anchors', () => {
    for (const state of ORB_STATES) {
      for (const a of [STATE_ANCHORS[state].a20, STATE_ANCHORS[state].a64]) {
        // log-space interpolation means a zero or negative here yields
        // -Infinity / NaN rather than an obvious failure
        expect(a.speed, `${state} speed`).toBeGreaterThan(0);
        expect(a.count, `${state} count`).toBeGreaterThan(0);
        expect(a.size, `${state} size`).toBeGreaterThan(0);
      }
    }
  });

  it('every state resolves to a registered mode', () => {
    for (const state of ORB_STATES) {
      expect(resolvePreset(state, 64).mode).toBeTruthy();
    }
  });
});

describe('progress modes', () => {
  it('declares exactly the modes that read progress', () => {
    expect([...PROGRESS_MODES].sort()).toEqual(['cascade', 'funnel', 'raster', 'vortex']);
  });

  it('the progress-capable states map to those modes', () => {
    for (const s of ['queuing', 'reading', 'gathering', 'drafting'] as const) {
      expect(PROGRESS_MODES.has(resolvePreset(s, 64).mode), s).toBe(true);
    }
    for (const s of ['working', 'connecting', 'syncing', 'retrying'] as const) {
      expect(PROGRESS_MODES.has(resolvePreset(s, 64).mode), s).toBe(false);
    }
  });
});

describe('error and retrying are separate modes', () => {
  it('do not share a painter', () => {
    // As a `shatter` variant, error differed from retrying only in TIMING and
    // read as the same animation mid-burst. Colour would have separated them,
    // but this library is single-hue by design, so the split is structural.
    expect(resolvePreset('retrying', 64).mode).toBe('shatter');
    expect(resolvePreset('error', 64).mode).toBe('fault');
  });

  it('only error declares a cycle, so only error can be held with `once`', () => {
    expect(resolvePreset('error', 64).cycle).toBeGreaterThan(0);
    expect(resolvePreset('retrying', 64).cycle).toBeUndefined();
  });

  it("error's cycle ends as the X finishes forming, not after the reset", () => {
    expect(resolvePreset('error', 64).cycle).toBeCloseTo(faultCycle(), 10);
  });

  it('retrying still reassembles', () => {
    expect(resolvePreset('retrying', 64).opts.settle).toBe(1);
    expect(shatterCycle(1)).toBeGreaterThan(shatterCycle(0));
  });
});
