// Per-knob tuning for the selected state. Sliders drive the raw engine opts of
// a directly-driven canvas, and "Copy preset" emits a paste-ready entry for
// src/presets.ts — this is how the new states' first-pass numbers get dialled
// in and baked.

import {
  type OrbState,
  type Palette,
  type PaletteName,
  type Ramp,
  resolvePreset
} from '@nowah/orbs';
import { useMemo, useState } from 'react';
import { RawOrb } from './RawOrb';
import { Slider } from './ui';

/** Knob ranges per opt key. Everything else is left alone. */
const KNOBS: Record<string, [min: number, max: number, step: number]> = {
  latRings: [2, 40, 1],
  rings: [2, 40, 1],
  lonDensity: [2, 80, 1],
  lanes: [1, 24, 1],
  segs: [8, 200, 1],
  orbitN: [1, 60, 1],
  ghostN: [1, 400, 1],
  particles: [1, 12, 1],
  moveCount: [1, 30, 1],
  rBase: [0, 6, 0.01],
  rDepth: [0, 8, 0.01],
  rActive: [0, 3, 0.01],
  rBoost: [0, 6, 0.01],
  rDot: [0.001, 0.2, 0.001],
  ghostR: [0, 6, 0.01],
  ghostA: [0, 1, 0.01],
  partR: [0, 8, 0.01],
  partRDepth: [0, 8, 0.01],
  iconD: [0.05, 4, 0.01],
  inkFar: [0, 1, 0.01],
  inkSpan: [0, 1, 0.01],
  scanMul: [0, 10, 0.005],
  dimBase: [0, 1, 0.01],
  spin: [0, 3, 0.01],
  bandMul: [0, 10, 0.01],
  wobMul: [0, 4, 0.01],
  spread: [0.2, 3, 0.005],
  rMin: [0, 2, 0.05],
  rsPow: [0, 1.5, 0.01],

  // batch-1 modes. A knob missing from this map simply won't render, so new
  // opt names have to be added here to be tunable.
  // route
  arcN: [4, 80, 1],
  pool: [6, 60, 1],
  rArc: [0, 4, 0.01],
  rHead: [0, 5, 0.01],
  rEnd: [0, 6, 0.01],
  inkArc: [0, 1, 0.01],
  trailA: [0, 1, 0.01],
  headWidth: [0.02, 0.6, 0.005],
  lift: [0, 0.4, 0.005],
  // sonar
  ringN: [1, 10, 1],
  ringDots: [4, 90, 1],
  reach: [0.3, 1.2, 0.01],
  period: [0.2, 4, 0.01],
  rTaper: [0, 2, 0.01],
  rCore: [0, 5, 0.01],
  rPulse: [0, 4, 0.01],
  inkNear: [0, 1, 0.01],
  ringA: [0, 1, 0.01],
  fade: [0, 1, 0.01],
  // graph
  nodeN: [4, 60, 1],
  edgeN: [2, 16, 1],
  trail: [1, 12, 1],
  cometLen: [0.05, 1, 0.01],
  rGlow: [0, 5, 0.01],
  inkNode: [0, 1, 0.01],
  inkGlow: [0, 1, 0.01],
  nodeA: [0, 1, 0.01],
  // funnel
  partN: [2, 140, 1],
  shellN: [3, 60, 1],
  shellRings: [2, 16, 1],
  waist: [0.02, 0.6, 0.01],
  flowRate: [0.05, 2, 0.01],
  rShell: [0, 3, 0.01],
  rHot: [0, 3, 0.01],
  inkShell: [0, 1, 0.01],
  inkPart: [0, 1, 0.01],
  shellA: [0, 1, 0.01],
  // raster
  cols: [2, 40, 1],
  rows: [2, 40, 1],
  inset: [0, 0.35, 0.005],
  band: [0.2, 6, 0.05],
  cursorRate: [0, 12, 0.1],
  inkAhead: [0, 1, 0.01],
  inkRead: [0, 1, 0.01],
  inkActive: [0, 1, 0.01],
  baseA: [0, 1, 0.01],

  // batch-2 modes
  // vortex
  turns: [0.2, 6, 0.05],
  disk: [0, 1, 0.01],
  coreN: [1, 60, 1],
  inkCore: [0, 1, 0.01],
  partA: [0, 1, 0.01],
  tilt: [0, 1.4, 0.01],
  // helix
  coil: [4, 140, 1],
  pitch: [0.2, 6, 0.05],
  taper: [0, 0.9, 0.01],
  rungEvery: [1, 20, 1],
  rungDots: [1, 8, 1],
  rRung: [0, 3, 0.01],
  inkRung: [0, 1, 0.01],
  strandA: [0, 1, 0.01],
  rungA: [0, 1, 0.01],
  // cluster
  dotN: [4, 400, 1],
  groups: [2, 8, 1],
  rWinner: [0, 3, 0.01],
  inkWinner: [0, 1, 0.01],
  dotA: [0, 1, 0.01],
  // cascade
  ragged: [0, 0.9, 0.01],
  holdFrac: [0, 0.8, 0.01],
  inkWritten: [0, 1, 0.01],
  inkHead: [0, 1, 0.01],
  // shatter
  blast: [0, 3, 0.01],
  settle: [0, 1, 1],
  farK: [0, 2, 0.01],
  rFlash: [0, 3, 0.01],
  inkOut: [0, 1, 0.01]
};

export function TuningPanel({
  state,
  size,
  dark,
  palette,
  ramp,
  paused
}: {
  state: OrbState;
  size: number;
  dark: boolean;
  palette: PaletteName | Palette;
  ramp?: Ramp;
  paused: boolean;
}) {
  const base = useMemo(() => resolvePreset(state, size), [state, size]);
  // `null` = follow the resolved preset; an object = user overrides in play
  const [over, setOver] = useState<Record<string, number> | null>(null);
  const [speedMul, setSpeedMul] = useState(1);

  // reset overrides whenever the state or size changes underneath us
  const sig = `${state}-${size}`;
  const [lastSig, setLastSig] = useState(sig);
  if (lastSig !== sig) {
    setLastSig(sig);
    setOver(null);
    setSpeedMul(1);
  }

  const opts = useMemo(() => ({ ...base.opts, ...(over ?? {}) }), [base, over]);
  const keys = Object.keys(opts)
    .filter((k) => k in KNOBS && typeof opts[k] === 'number')
    .sort();

  const snippet = `${state}: {\n  mode: '${base.mode}',\n  a${size}: { speed: ${(
    base.speed * speedMul
  ).toFixed(3)}, /* count & size are multipliers — see presets.ts */\n    extra: {${keys
    .filter((k) => over && k in over)
    .map((k) => ` ${k}: ${opts[k]}`)
    .join(',')} }\n  }\n}`;

  return (
    <div className="wb-card">
      <h2>Tuning — {state}</h2>
      <div className="wb-row" style={{ alignItems: 'flex-start', gap: 22 }}>
        <div
          className="wb-stage"
          style={{ minHeight: 200, minWidth: 220, flex: '0 0 auto', padding: 20 }}
        >
          <span className="wb-stage-label">
            {base.mode} · {size}px
          </span>
          <RawOrb
            mode={base.mode}
            opts={opts}
            speed={base.speed * speedMul}
            size={size}
            dark={dark}
            palette={palette}
            ramp={ramp}
            paused={paused}
          />
        </div>

        <div style={{ flex: 1, minWidth: 300 }}>
          <div className="wb-knobs">
            <Slider
              label="speed ×"
              value={speedMul}
              min={0.1}
              max={3}
              step={0.01}
              onChange={setSpeedMul}
              width={undefined as unknown as number}
            />
            {keys.map((k) => {
              const [min, max, step] = KNOBS[k];
              return (
                <Slider
                  key={k}
                  label={k}
                  value={opts[k] as number}
                  min={min}
                  max={max}
                  step={step}
                  onChange={(v) => setOver({ ...(over ?? {}), [k]: v })}
                  width={undefined as unknown as number}
                />
              );
            })}
          </div>

          <div className="wb-btns" style={{ marginTop: 14 }}>
            <button
              className="wb-btn"
              type="button"
              onClick={() => {
                setOver(null);
                setSpeedMul(1);
              }}
            >
              Reset knobs
            </button>
            <button
              className="wb-btn"
              type="button"
              onClick={() => navigator.clipboard?.writeText(snippet)}
            >
              Copy preset
            </button>
          </div>
        </div>
      </div>

      <p className="wb-note">
        These sliders drive the <em>resolved</em> engine opts for {state} at {size}px, through the
        exported <code>MODE_BUILDS</code> / <code>renderCanvas2D</code> surface rather than the
        component. Dial a state in, hit <b>Copy preset</b>, and the numbers get baked into{' '}
        <code>src/presets.ts</code>. Note that <code>count</code>/<code>size</code> in presets.ts
        are multipliers over the base profile, so absolute counts here map back through{' '}
        <code>scaleCounts</code>.
      </p>
    </div>
  );
}
