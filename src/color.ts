// Colour ramps.
//
// Upstream painted every dot as `rgba(g,g,g,a)` where `g` was the dot's ink
// value mapped straight to an sRGB grey level. That made tinting impossible
// and allocated one template string per dot per frame (~34k strings/sec/orb
// on composing@64).
//
// Here a dot's ink value indexes a RAMP instead. The contract is uniform and
// backwards-compatible: **the ramp is indexed by the sRGB grey level it
// replaces** — ramp(0) is the darkest ink, ramp(1) the lightest/brightest.
// So the `mono` palette is a plain black→white ramp and reproduces upstream.
//
// Ramps interpolate in OkLab, not sRGB. Lerping saturated greens in sRGB
// drags midpoints through a muddy olive; OkLab keeps them on the hue.
// Interpolation happens ONCE at build time into a LUT, so the canvas only
// ever sees plain `rgba()` strings — upstream's "identical pixels in every
// browser" guarantee survives (no `oklch()` in fillStyle, no filters).

/** One ramp stop. `at` is the ink level in [0,1]; `hex` is `#rrggbb`. */
export interface Stop {
  at: number;
  hex: string;
}

/** A ramp: stops in ascending `at` order. Must span at least 0 and 1. */
export type Ramp = readonly Stop[];

/**
 * Interpolation space.
 *
 * `oklab` is perceptually even and what you want for saturated hues — lerping
 * greens in sRGB drags midpoints through a muddy olive.
 *
 * `srgb` exists because upstream's grayscale was defined as a straight sRGB
 * byte ramp (`g = ink * 255`). OkLab-lerping black→white is perceptually even
 * but lands ~29/255 off that curve at the midpoint, so `mono` must interpolate
 * in sRGB to actually reproduce it.
 */
export type RampSpace = 'oklab' | 'srgb';

/** A palette carries one ramp per substrate — inverting a hue's lightness
 *  does not produce a usable light-mode ramp, so they're authored separately. */
export interface Palette {
  dark: Ramp;
  light: Ramp;
  /** @default 'oklab' */
  space?: RampSpace;
}

export type PaletteName = 'green' | 'mono' | 'twoTone';

// --- Nowah brand ramps -------------------------------------------------
// Anchored on nowah/constants/design-tokens.ts:16-19. The brightest (most
// salient) dots land on #1FD08A, which those tokens document as the
// AA-passing green for small marks — #00A86B explicitly does not pass at
// icon size, and the 20px inline orb IS icon size.

const GREEN: Palette = {
  dark: [
    { at: 0.0, hex: '#04231A' }, // deep jade, sits just off the background
    { at: 0.3, hex: '#008754' }, // COLORS.primaryActive
    { at: 0.55, hex: '#00A86B' }, // COLORS.primary — the brand green
    { at: 0.8, hex: '#1FD08A' }, // COLORS.accentBright
    { at: 1.0, hex: '#9BF5CE' } // light jade highlight
  ],
  light: [
    { at: 0.0, hex: '#00563A' }, // darkest ink = most salient on light
    { at: 0.35, hex: '#00794E' },
    { at: 0.6, hex: '#00A86B' },
    { at: 1.0, hex: '#B8E8D2' }
  ]
};

/** Upstream grayscale. sRGB space, so it reproduces `g = ink * 255` exactly. */
const MONO: Palette = {
  space: 'srgb',
  dark: [
    { at: 0.0, hex: '#000000' },
    { at: 1.0, hex: '#FFFFFF' }
  ],
  light: [
    { at: 0.0, hex: '#000000' },
    { at: 1.0, hex: '#FFFFFF' }
  ]
};

/** Green reads as a highlight on a neutral base. */
const TWO_TONE: Palette = {
  dark: [
    { at: 0.0, hex: '#2A2A2C' },
    { at: 0.45, hex: '#4A5551' },
    { at: 0.72, hex: '#00A86B' },
    { at: 1.0, hex: '#1FD08A' }
  ],
  light: [
    { at: 0.0, hex: '#00563A' },
    { at: 0.3, hex: '#00A86B' },
    { at: 0.65, hex: '#9BA1A6' },
    { at: 1.0, hex: '#E4E4E7' }
  ]
};

export const PALETTES: Record<PaletteName, Palette> = {
  green: GREEN,
  mono: MONO,
  twoTone: TWO_TONE
};

// --- sRGB <-> OkLab ----------------------------------------------------
// Björn Ottosson's OkLab. https://bottosson.github.io/posts/oklab/

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

type Lab = [number, number, number];

function hexToLab(hex: string): Lab {
  const h = hex.replace('#', '');
  const r = srgbToLinear(Number.parseInt(h.slice(0, 2), 16) / 255);
  const g = srgbToLinear(Number.parseInt(h.slice(2, 4), 16) / 255);
  const b = srgbToLinear(Number.parseInt(h.slice(4, 6), 16) / 255);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  ];
}

/** OkLab → sRGB bytes, gamut-clamped per channel. */
function labToRgb(lab: Lab): [number, number, number] {
  const [L, A, B] = lab;
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(linearToSrgb(v) * 255)));
  return [clamp(r), clamp(g), clamp(b)];
}

// --- LUT ---------------------------------------------------------------
// Ink is quantised to L_LEVELS and alpha to A_LEVELS. 6 bits of ink and 5 of
// alpha are imperceptible on 1-3px dots, and the coarse buckets are what let
// the painter coalesce runs of identical fillStyle (see render/canvas2d.ts).
// Finer buckets would shorten those runs and give back the win.

export const L_LEVELS = 64;
export const A_LEVELS = 32;

export interface RampLut {
  /** L_LEVELS × 3 sRGB bytes. */
  rgb: Uint8Array;
  /** Lazily-filled `rgba()` strings, indexed L_LEVELS × A_LEVELS. */
  styles: Array<string | undefined>;
}

function hexToBytes(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16)
  ];
}

function buildLut(ramp: Ramp, space: RampSpace): RampLut {
  const oklab = space !== 'srgb';
  const nodes = ramp.map((s) => (oklab ? hexToLab(s.hex) : hexToBytes(s.hex)));
  const rgb = new Uint8Array(L_LEVELS * 3);

  for (let i = 0; i < L_LEVELS; i++) {
    const at = i / (L_LEVELS - 1);

    // locate the bracketing stops
    let hi = 1;
    while (hi < ramp.length - 1 && ramp[hi].at < at) hi++;
    const lo = hi - 1;
    const span = ramp[hi].at - ramp[lo].at;
    const f = span > 0 ? Math.max(0, Math.min(1, (at - ramp[lo].at) / span)) : 0;

    const a = nodes[lo];
    const b = nodes[hi];
    const mixed: [number, number, number] = [
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f
    ];
    const [r, g, bl] = oklab
      ? labToRgb(mixed)
      : [Math.round(mixed[0]), Math.round(mixed[1]), Math.round(mixed[2])];
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = bl;
  }

  return { rgb, styles: new Array(L_LEVELS * A_LEVELS) };
}

// Memoised per resolved ramp. Keyed by identity for the built-in palettes and
// by serialised stops for custom ramps, so a caller passing a fresh array
// literal every render doesn't rebuild the LUT each frame.
const lutCache = new Map<string, RampLut>();
const lutByRef = new WeakMap<object, RampLut>();

function rampKey(ramp: Ramp, space: RampSpace): string {
  let k = `${space}|`;
  for (const s of ramp) k += `${s.at}:${s.hex};`;
  return k;
}

function lutFor(ramp: Ramp, space: RampSpace): RampLut {
  const byRef = lutByRef.get(ramp as unknown as object);
  if (byRef) return byRef;
  const key = rampKey(ramp, space);
  let hit = lutCache.get(key);
  if (!hit) {
    hit = buildLut(ramp, space);
    lutCache.set(key, hit);
  }
  lutByRef.set(ramp as unknown as object, hit);
  return hit;
}

/** Resolve (palette | custom ramp, substrate) to a memoised LUT. */
export function getLut(
  palette: PaletteName | Palette,
  dark: boolean,
  custom?: Ramp,
  space?: RampSpace
): RampLut {
  if (custom) return lutFor(custom, space ?? 'oklab');
  const pal = typeof palette === 'string' ? (PALETTES[palette] ?? PALETTES.green) : palette;
  return lutFor(dark ? pal.dark : pal.light, space ?? pal.space ?? 'oklab');
}

/** Bucketed `rgba()` string for an (ink, alpha) pair. Cached in the LUT. */
export function styleFor(lut: RampLut, lBucket: number, aBucket: number): string {
  const idx = lBucket * A_LEVELS + aBucket;
  const hit = lut.styles[idx];
  if (hit !== undefined) return hit;
  const o = lBucket * 3;
  const alpha = aBucket / (A_LEVELS - 1);
  // 3 decimals is plenty and keeps the strings short
  const s = `rgba(${lut.rgb[o]},${lut.rgb[o + 1]},${lut.rgb[o + 2]},${Math.round(alpha * 1000) / 1000})`;
  lut.styles[idx] = s;
  return s;
}
