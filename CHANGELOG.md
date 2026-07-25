# Changelog

## 0.1.0 — fork of `thinking-orbs@0.1.1`

Forked from [Jakubantalik/thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) and renamed
to `@nowah/orbs`. The hand-tuned per-size presets — the real intellectual content of the original —
are preserved byte-for-byte at the 20px and 64px anchors; geometry output is verified identical to
upstream for all six original states at both sizes.

### Breaking behaviour changes

- **`speed` is a rate, not a phase scale.** Upstream derived time as
  `performance.now()/1000 * baseSpeed * speed`, so changing `speed` retroactively rescaled all
  elapsed time: nudging `1 → 1.01` after 20 minutes of uptime jumped the animation **23 seconds**
  forward. Time now accumulates locally from per-frame `dt`, seeded from a shared clock at mount, so
  equal-speed orbs still stay in phase (including ones mounted later) while a speed change alters the
  rate from that moment on.
- **`paused` is a true freeze-and-resume.** It previously froze, then jumped to wall-clock position on
  resume.
- **The default palette is `green`.** Pass `palette="mono"` for the original grayscale.
- **`OrbSize` is now `number`,** widened from `64 | 20`.

### Added

- **Colour ramps.** `palette` (`green` | `mono` | `twoTone`) and `ramp` for custom stops, indexed by
  the ink level they replace. Ramps interpolate in OkLab — sRGB lerping drags saturated greens through
  a muddy olive — precomputed once into a LUT so the canvas only ever sees plain `rgba()`.
  Dark and light substrates get separately authored ramps.
- **Arbitrary sizes, 12–256.** Log-space interpolation between the 20 and 64 anchors. Dev warning
  outside 16–128 where tunings are extrapolated.
- **Five new states** — `idle`, `analyzing`, `booking`, `streaming`, `success` — as re-tunings of the
  existing engine modes, no new painters.
- **`once`** — play one cycle and hold, for terminal states that declare a natural cycle (`success`).
- **`crossfade`** — cross-fade on state change instead of hard-cutting. Defaults to 300ms.
- **`batchPaths`** — coalesce same-colour dots into one path with a single fill. ~10× fewer `fill()`
  calls, but overlapping semi-transparent dots union rather than double-darken, so it's opt-in.
- **Renderer-agnostic engine.** Modes emit a `DotBuffer` of geometry with zero DOM access;
  `renderCanvas2D` turns it into pixels. A React Native Skia renderer is now a sibling module rather
  than a rewrite.
- Test suite: 70 tests including golden-frame snapshots that lock every state's geometry at three
  sizes and four phases.
- The demo is now a tuning workbench — all states at once, ramp editor, per-knob engine sliders with
  preset export, and a perf HUD.

### Fixed

- **`size={32}` from a JS caller crashed** with `TypeError: Cannot read properties of undefined
  (reading 'count')`. Invalid and out-of-range sizes now warn and clamp.
- **Every instance installed its own document-wide `MutationObserver`** (`subtree: true`) watching
  `class` and `data-theme` — 20 inline orbs meant 20 whole-document observers firing on any class
  toggle anywhere in the app. Now one shared observer fans out to all subscribers.
- **One `rgba()` template string was allocated per dot per frame** — ~34,000/sec/orb on `composing` at
  64px. Every distinct string is now built once and cached; steady-state allocation is zero.
- **A fresh `Dot[]` was allocated and sorted every frame.** The buffer is pooled and z-sorts through a
  reusable index array.
- **`drawRubik` rebuilt its deterministic move table every frame** (14 objects + 42 `hashD()` calls,
  byte-identical each time), and `drawMorph` re-measured a 160-point arc-length table. Both memoised.
- **Any prop change tore down the effect and re-initialised the canvas,** clearing it —
  including `speed` and `paused`. Only `size` and DPR now rebuild the backing store.
- **First-paint polarity flash:** the theme defaulted to dark and was corrected a commit later, so
  light-background apps painted one inverted frame. Resolved synchronously via
  `useSyncExternalStore`.
- **One `requestAnimationFrame` loop per instance.** Now a single shared driver that stops entirely
  when the last orb unmounts.
- **DPR changes were not observed,** leaving a stale backing store when a window moved between Retina
  and non-Retina displays.
- Dot count no longer extrapolates unbounded above the top anchor — `working@256` resolved to 14,784
  dots/frame (~890k arcs/sec at 60fps); it is now capped at 2,744.

### Project

- `@biomejs/biome` added — `biome.json` was committed upstream but the dependency was missing and
  there was no `lint` script.
- CI now typechecks, builds and tests on push and PR; upstream CI only published and deployed Pages.
- `LICENSE` retains the upstream MIT copyright notice, as required, with ours added below.
