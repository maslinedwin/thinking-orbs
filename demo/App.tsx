// The @nowah/orbs workbench.
//
// Two jobs: show every state at once so nothing hides, and be the tuning rig
// where the ramp endpoints and the new states' first-pass numbers get dialled
// in before they're baked into src/.

import {
  ORB_STATES,
  type OrbState,
  PALETTES,
  type PaletteName,
  PROGRESS_MODES,
  type Ramp,
  resolvePreset,
  ThinkingOrb
} from '@nowah/orbs';
import { useEffect, useMemo, useState } from 'react';
import { PerfHud } from './components/PerfHud';
import { RampEditor } from './components/RampEditor';
import { TuningPanel } from './components/TuningPanel';
import { BtnGroup, Slider, Toggle } from './components/ui';
import { useTheme } from './hooks/useTheme';

const PALETTE_NAMES: PaletteName[] = ['green', 'nebula', 'mono', 'twoTone'];
const GRID_SIZES = [20, 32, 64] as const;
const SIZE_PRESETS = [16, 20, 32, 48, 64, 96, 128] as const;

export function App() {
  const [theme, toggleTheme] = useTheme();
  const dark = theme === 'dark';

  const [state, setState] = useState<OrbState>('searching');
  const [size, setSize] = useState(64);
  const [speed, setSpeed] = useState(1);
  const [palette, setPalette] = useState<PaletteName>('green');
  const [paused, setPaused] = useState(false);
  const [once, setOnce] = useState(false);
  const [crossfade, setCrossfade] = useState(300);
  const [batchPaths, setBatchPaths] = useState(false);
  const [customRamp, setCustomRamp] = useState<Ramp | null>(null);
  const [autoCycle, setAutoCycle] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  // `null` = indeterminate (prop omitted); a number = determinate
  const [progress, setProgress] = useState<number | null>(null);

  // only some modes can express progress; the control hides for the rest
  const canProgress = PROGRESS_MODES.has(resolvePreset(state, size).mode);

  // The ramp editor edits whichever substrate is showing.
  const brandRamp = dark
    ? PALETTES[palette === 'mono' || palette === 'twoTone' ? 'green' : palette].dark
    : PALETTES[palette === 'mono' || palette === 'twoTone' ? 'green' : palette].light;
  const ramp = customRamp ?? undefined;
  useEffect(() => setCustomRamp(null), [dark]);

  // Auto-cycle exists to exercise the crossfade — state changes constantly in a
  // real agent UI, and upstream hard-cut between them.
  useEffect(() => {
    if (!autoCycle) return;
    const id = setInterval(() => {
      setState((s) => ORB_STATES[(ORB_STATES.indexOf(s) + 1) % ORB_STATES.length]);
    }, 1800);
    return () => clearInterval(id);
  }, [autoCycle]);

  const shared = { palette, ramp, speed, paused, crossfade, batchPaths, theme } as const;

  const snippet = useMemo(() => {
    const props = [`state="${state}"`, `size={${size}}`];
    if (palette !== 'green') props.push(`palette="${palette}"`);
    if (speed !== 1) props.push(`speed={${speed}}`);
    if (once) props.push('once');
    if (canProgress && progress !== null) props.push(`progress={${progress.toFixed(2)}}`);
    if (crossfade !== 300) props.push(`crossfade={${crossfade}}`);
    if (batchPaths) props.push('batchPaths');
    return `import { ThinkingOrb } from '@nowah/orbs';\n\n<ThinkingOrb ${props.join(' ')} />`;
  }, [state, size, palette, speed, once, crossfade, batchPaths, canProgress, progress]);

  return (
    <main className="wb">
      <header className="wb-head">
        <div>
          <h1 className="wb-title">@nowah/orbs</h1>
          <p className="wb-sub">
            {ORB_STATES.length} states · any size 12–256 · Nowah brand ramp · workbench
          </p>
        </div>
        <div className="wb-btns">
          <Toggle label={dark ? 'Dark' : 'Light'} on={false} onToggle={toggleTheme} />
          <Toggle
            label={paused ? 'Paused' : 'Playing'}
            on={paused}
            onToggle={() => setPaused((p) => !p)}
          />
          <Toggle label="Auto-cycle" on={autoCycle} onToggle={() => setAutoCycle((a) => !a)} />
        </div>
      </header>

      {/* ---------- every state, all at once ---------- */}
      <section className="wb-card">
        <h2>All states — click to focus</h2>
        <div className="wb-grid">
          {ORB_STATES.map((s) => (
            <div key={s} className={`wb-cell${s === state ? ' sel' : ''}`}>
              <button type="button" onClick={() => setState(s)} aria-label={`Focus ${s}`}>
                <div className="wb-cell-orbs">
                  {GRID_SIZES.map((sz) => (
                    <ThinkingOrb key={sz} state={s} size={sz} {...shared} />
                  ))}
                </div>
                <span className="wb-cell-name">{s}</span>
              </button>
            </div>
          ))}
        </div>
        <p className="wb-note">
          Each cell renders 20 / 32 / 64px. 20 and 64 are the hand-tuned anchors; 32 is interpolated
          between them — upstream typed <code>size</code> as <code>64 | 20</code> and threw a
          TypeError on anything else.
        </p>
      </section>

      {/* ---------- focus stage + controls ---------- */}
      <section className="wb-card">
        <h2>Stage</h2>
        <div className="wb-stage" style={{ minHeight: Math.max(132, size + 72) }}>
          <span className="wb-stage-label">
            {state} · {size}px · {palette}
            {ramp ? ' · custom ramp' : ''}
          </span>
          <ThinkingOrb
            state={state}
            size={size}
            once={once}
            progress={canProgress && progress !== null ? progress : undefined}
            {...shared}
          />
        </div>

        <div className="wb-row" style={{ marginTop: 16 }}>
          <Slider label="size" value={size} min={12} max={256} onChange={setSize} suffix="px" />
          <Slider
            label="speed"
            value={speed}
            min={0.1}
            max={3}
            step={0.01}
            onChange={setSpeed}
            suffix="×"
          />
          <Slider
            label="crossfade"
            value={crossfade}
            min={0}
            max={1200}
            step={25}
            onChange={setCrossfade}
            suffix="ms"
          />
          {canProgress ? (
            <div className="wb-field" style={{ width: 210 }}>
              <Slider
                label="progress"
                value={progress ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={setProgress}
              />
              <Toggle
                label={progress === null ? 'indeterminate' : 'determinate'}
                on={progress !== null}
                onToggle={() => setProgress((p) => (p === null ? 0.4 : null))}
              />
            </div>
          ) : null}
        </div>

        <div className="wb-row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <BtnGroup label="palette" options={PALETTE_NAMES} value={palette} onChange={setPalette} />
          <BtnGroup
            label="size presets"
            options={SIZE_PRESETS}
            value={size as (typeof SIZE_PRESETS)[number]}
            onChange={(n) => setSize(n)}
          />
          <div className="wb-field">
            <span className="wb-label">flags</span>
            <div className="wb-btns">
              <Toggle label="once" on={once} onToggle={() => setOnce((o) => !o)} />
              <Toggle
                label="batch paths"
                on={batchPaths}
                onToggle={() => setBatchPaths((b) => !b)}
              />
              <Toggle label="tuning" on={showTuning} onToggle={() => setShowTuning((t) => !t)} />
            </div>
          </div>
        </div>

        <div className="wb-row" style={{ marginTop: 14 }}>
          <BtnGroup label="state" options={ORB_STATES} value={state} onChange={setState} />
        </div>

        <pre className="wb-code" style={{ marginTop: 14 }}>
          {snippet}
        </pre>

        <p className="wb-note">
          Drag <b>speed</b>: it changes the rate smoothly. Upstream derived time as{' '}
          <code>performance.now()/1000 * speed</code>, so nudging 1 → 1.01 after 20 minutes of
          uptime teleported the animation 23 seconds forward. <b>once</b> only affects states that
          declare a natural cycle (<code>success</code>); the rest loop.
        </p>
      </section>

      {/* ---------- in-context pills ---------- */}
      <section className="wb-card">
        <h2>In context</h2>
        <div className="wb-row" style={{ alignItems: 'center', gap: 14 }}>
          <span className="wb-pill">
            <ThinkingOrb state={state} size={34} {...shared} />
            Searching flights to Lisbon…
          </span>
          <span className="wb-pill sm">
            <ThinkingOrb state={state} size={18} {...shared} />
            Agent working
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <ThinkingOrb state={state} size={15} {...shared} />
            <span style={{ fontSize: 13 }}>inline at text scale</span>
          </span>
        </div>
        <p className="wb-note">
          34px, 18px and 15px are all interpolated sizes. Nowah green peaks at <code>#1FD08A</code>;
          Nebula pink peaks around brand <code>#F312A4</code> (from the nebula.gg icon). Switch the
          palette control above to compare.
        </p>
      </section>

      <PerfHud
        state={state}
        size={size}
        dark={dark}
        palette={palette}
        ramp={ramp}
        batchPaths={batchPaths}
      />

      <RampEditor
        ramp={customRamp ?? brandRamp}
        dark={dark}
        onChange={setCustomRamp}
        onReset={() => setCustomRamp(null)}
      />

      {showTuning ? (
        <TuningPanel
          state={state}
          size={size}
          dark={dark}
          palette={palette}
          ramp={ramp}
          paused={paused}
        />
      ) : null}

      <footer className="wb-sub" style={{ textAlign: 'center', marginTop: 8 }}>
        Fork of{' '}
        <a
          href="https://github.com/Jakubantalik/thinking-orbs"
          style={{ color: 'var(--wb-accent)' }}
        >
          thinking-orbs
        </a>{' '}
        by Jakub Antalik · MIT
      </footer>
    </main>
  );
}
