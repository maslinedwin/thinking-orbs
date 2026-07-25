// Live ramp editor. Two of the green ramp's five stops were first-pass guesses
// (the deep and the highlight ends); this is where they get settled and baked
// back into src/color.ts.

import { getLut, L_LEVELS, type Ramp } from '@nowah/orbs';

function RampBar({ ramp, dark }: { ramp: Ramp; dark: boolean }) {
  const lut = getLut('green', dark, ramp);
  const stops: string[] = [];
  for (let i = 0; i < L_LEVELS; i += 2) {
    stops.push(`rgb(${lut.rgb[i * 3]},${lut.rgb[i * 3 + 1]},${lut.rgb[i * 3 + 2]})`);
  }
  return (
    <div
      className="wb-swatch"
      style={{ background: `linear-gradient(90deg, ${stops.join(',')})`, height: 30 }}
      title="darkest ink (left) → brightest (right)"
    />
  );
}

export function RampEditor({
  ramp,
  dark,
  onChange,
  onReset
}: {
  ramp: Ramp;
  dark: boolean;
  onChange: (r: Ramp) => void;
  onReset: () => void;
}) {
  const set = (i: number, patch: Partial<{ at: number; hex: string }>) => {
    const next = ramp.map((s, j) => (i === j ? { ...s, ...patch } : s));
    next.sort((a, b) => a.at - b.at);
    onChange(next);
  };

  const snippet = `[\n${ramp
    .map((s) => `  { at: ${s.at.toFixed(2)}, hex: '${s.hex.toUpperCase()}' }`)
    .join(',\n')}\n]`;

  return (
    <div className="wb-card">
      <h2>Ramp editor — {dark ? 'dark' : 'light'} substrate</h2>
      <RampBar ramp={ramp} dark={dark} />
      <div className="wb-stops" style={{ marginTop: 12 }}>
        {ramp.map((s, i) => (
          <div className="wb-stop" key={`${i}-${s.hex}`}>
            <input
              type="color"
              value={s.hex}
              onChange={(e) => set(i, { hex: e.target.value })}
              aria-label={`Stop ${i + 1} colour`}
            />
            <code className="wb-hex">{s.hex.toUpperCase()}</code>
            <input
              className="wb-range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.at}
              onChange={(e) => set(i, { at: Number(e.target.value) })}
              aria-label={`Stop ${i + 1} position`}
              style={{ flex: 1 }}
            />
            <b style={{ width: 34, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              {s.at.toFixed(2)}
            </b>
          </div>
        ))}
      </div>
      <div className="wb-btns" style={{ marginTop: 12 }}>
        <button className="wb-btn" type="button" onClick={onReset}>
          Reset to brand ramp
        </button>
        <button
          className="wb-btn"
          type="button"
          onClick={() => navigator.clipboard?.writeText(snippet)}
        >
          Copy stops
        </button>
      </div>
      <pre className="wb-code" style={{ marginTop: 12 }}>
        {snippet}
      </pre>
      <p className="wb-note">
        Stops are indexed by the ink level they replace — <code>at: 0</code> is the darkest ink,{' '}
        <code>at: 1</code> the brightest. Interpolated in OkLab, so midpoints stay on the hue
        instead of sliding into olive. Editing here overrides the <code>palette</code> prop
        everywhere on the page.
      </p>
    </div>
  );
}
