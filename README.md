# @nowah/orbs

Dotted thought-orb loading indicators for AI & agent UIs. Eleven animated states at any size from 12
to 256px, rendered on a plain 2D canvas in Nowah's brand green — no WebGL, no filters, identical
pixels in Chrome, Safari and Firefox.

A fork of [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) by Jakub Antalik (MIT).

## Install

```bash
npm install @nowah/orbs
```

## Quick start

```tsx
import { ThinkingOrb } from '@nowah/orbs';

function Status() {
  return <ThinkingOrb state="searching" size={64} />;
}
```

## Workbench

```bash
npm run dev     # http://localhost:5177
```

Every state at every size, live, plus a ramp editor, per-knob engine tuning sliders and a perf
readout. This is where new state tunings and ramp endpoints get dialled in before they're baked into
`src/`.

## States

```tsx
<ThinkingOrb state="working" />    {/* particles on tilted orbits */}
<ThinkingOrb state="searching" />  {/* a scan meridian sweeps a dotted globe */}
<ThinkingOrb state="solving" />    {/* bands scramble, then click back solved */}
<ThinkingOrb state="listening" />  {/* a waveform rolls through the rings */}
<ThinkingOrb state="composing" />  {/* an undulating multi-band sash */}
<ThinkingOrb state="shaping" />    {/* dotted outline: circle → triangle → square */}
<ThinkingOrb state="idle" />       {/* slow low-contrast breathing */}
<ThinkingOrb state="analyzing" />  {/* a tighter, faster scan than searching */}
<ThinkingOrb state="booking" />    {/* fewer, slower, decisive turns — locking in */}
<ThinkingOrb state="streaming" />  {/* continuous directional flow */}
<ThinkingOrb state="success" once />  {/* one-shot: scrambles, then clicks solved */}
```

## Sizes

Any size in 12–256. **20 and 64 are hand-tuned anchors** — separate designs with their own dot
count, dot size and speed — and every other size interpolates between them in log space. Sizes
outside 16–128 render but warn in dev, since the tunings are extrapolated there.

```tsx
<ThinkingOrb state="working" size={64} />  {/* chat-avatar scale (anchor) */}
<ThinkingOrb state="working" size={20} />  {/* inline-text scale (anchor) */}
<ThinkingOrb state="working" size={34} />  {/* interpolated */}
```

## Colour

Three palettes ship. `green` is the default.

```tsx
<ThinkingOrb palette="green" />    {/* Nowah brand jade ramp */}
<ThinkingOrb palette="mono" />     {/* the original grayscale */}
<ThinkingOrb palette="twoTone" />  {/* green highlights on a neutral base */}
```

The orb's visual language is a **lightness ramp encoding depth**, so a single flat colour would
collapse depth from two channels to one and read flat. Instead the ink level indexes a ramp, built
from Nowah's design tokens:

| ink | hex | token |
|---|---|---|
| 0.00 | `#04231A` | deep jade, just off the background |
| 0.30 | `#008754` | `primaryActive` |
| 0.55 | `#00A86B` | `primary` — the brand green |
| 0.80 | `#1FD08A` | `accentBright` |
| 1.00 | `#9BF5CE` | light jade highlight |

The brightest — most salient — dots land on `#1FD08A`, which Nowah's tokens document as the
AA-passing green for small marks; `#00A86B` explicitly does not pass at icon size, and the 20px
inline orb *is* icon size.

Ramps interpolate in **OkLab**, since lerping saturated greens in sRGB drags midpoints through a
muddy olive. Interpolation happens once at build time into a lookup table, so the canvas only ever
sees plain `rgba()` strings.

Custom ramps take stops indexed by the ink level they replace — `at: 0` is the darkest ink, `at: 1`
the brightest:

```tsx
<ThinkingOrb ramp={[
  { at: 0, hex: '#0A1F2E' },
  { at: 0.6, hex: '#2E90C4' },
  { at: 1, hex: '#B8E4F5' }
]} />
```

## Theme

```tsx
<ThinkingOrb theme="auto" />   {/* default — detects from the project */}
<ThinkingOrb theme="dark" />   {/* pin the dark-substrate ramp */}
<ThinkingOrb theme="light" />  {/* pin the light-substrate ramp */}
```

`auto` resolves in three layers and updates live:

1. an ancestor `data-theme="dark|light"` attribute or `dark`/`light` class (the Tailwind / shadcn
   convention), watched via a single shared `MutationObserver` for the whole page;
2. otherwise `prefers-color-scheme`, subscribed for live OS theme switches;
3. SSR-safe — the canvas paints client-side only, and the theme resolves synchronously on the first
   client render, before any paint.

Dark and light get **separately authored ramps**; inverting a hue's lightness does not produce a
usable light-mode ramp.

## Other props

```tsx
<ThinkingOrb
  state="solving"
  size={20}
  speed={1.5}          // multiplier on the preset's baked speed
  paused={false}       // freeze, holding the current frame
  once={false}         // play one cycle and hold (states with a natural cycle)
  crossfade={300}      // ms to cross-fade on state change; 0 = hard cut
  batchPaths={false}   // coalesce same-colour dots into one fill (see below)
  aria-label="Analysing repository…"  // overrides the per-state default
/>
```

All other `<canvas>` props (`className`, `style`, `data-*`, …) pass through.

`batchPaths` cuts `fill()` calls by ~10× but makes overlapping semi-transparent dots union rather
than double-darken, so the look changes subtly. Off by default; compare it in the workbench.

## Accessibility & performance

- `role="img"` with a sensible per-state `aria-label` out of the box.
- `prefers-reduced-motion: reduce` renders a static representative frame — no animation — and still
  follows the live theme.
- **One shared `requestAnimationFrame` loop** drives every mounted orb, and stops entirely when the
  last one unmounts. Instances pause when scrolled offscreen (`IntersectionObserver`) or when the tab
  is hidden.
- Orbs at the same speed stay **in phase**, including ones mounted later.
- Every distinct `rgba()` string is built once and cached, so the steady-state allocation rate is
  zero. Upstream built one per dot per frame — ~34,000 strings/sec/orb on `composing` at 64px.
- The dot buffer is pooled and sorted through a reusable index array, so frames allocate nothing.
- Plain 2D canvas arcs only: no `ctx.filter`, no SVG filters, no WebGL. Device-pixel-ratio capped at
  2, and re-read when the window moves between displays.

## Power-user surface

The engine is renderer-agnostic — modes emit geometry, not pixels — so you can drive your own canvas,
or add a React Native Skia renderer later without touching the engine:

```tsx
import {
  MODE_BUILDS, DotBuffer, renderCanvas2D, getLut, resolvePreset, subscribeFrames
} from '@nowah/orbs';

const { mode, speed, opts } = resolvePreset('searching', 48);
const buf = new DotBuffer();
let t = 0;

subscribeFrames((dt) => {
  t += dt;
  buf.reset();
  MODE_BUILDS[mode](buf, 48, t * speed, opts);            // geometry, zero DOM
  renderCanvas2D(ctx, buf, getLut('green', true), true);  // pixels
});
```

## Differences from upstream

Behaviour changes worth knowing if you've used `thinking-orbs`:

- **`speed` is now a rate, not a phase scale.** Upstream computed
  `performance.now()/1000 * speed`, so nudging `1 → 1.01` after 20 minutes of uptime jumped the
  animation 23 seconds forward. Time now accumulates locally and seeds from the shared clock.
- **`paused` is a true freeze-and-resume** rather than freeze-then-jump-to-wall-clock.
- **The default palette is green,** not grayscale. Pass `palette="mono"` for the original.
- **`size` accepts any number** in 12–256; it was `64 | 20`, and anything else threw a `TypeError`.
- Prop changes no longer tear down and re-initialise (and thus clear) the canvas.

See `CHANGELOG.md`.

## License

MIT. Original work © Jakub Antalik; fork modifications © Nowah. The upstream copyright notice is
retained in `LICENSE` as the license requires.
