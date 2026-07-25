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
  rsPow: [0, 1.5, 0.01]
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
