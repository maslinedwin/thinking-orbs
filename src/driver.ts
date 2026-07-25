// One shared requestAnimationFrame loop for every mounted orb.
//
// Upstream ran an independent rAF loop per instance. This runs exactly one,
// stops entirely when the last subscriber leaves, and advances a shared clock
// so instances can stay in phase.
//
// The shared clock is what makes the phase guarantee work WITHOUT the bug it
// used to carry. Upstream derived time as `performance.now()/1000 * speed`,
// which is phase-locked but means changing `speed` retroactively rescales all
// elapsed time — nudging 1 → 1.01 after 20 min of uptime jumped the animation
// forward 23 seconds. Instead, subscribers accumulate their own time from `dt`
// and SEED it from this clock at mount: equal-speed orbs stay in phase
// (including ones mounted later), and a speed change alters the rate from that
// moment on instead of teleporting.

export type Tick = (dt: number) => void;

const subs = new Set<Tick>();
let raf = 0;
let last = 0;

/** Seconds accumulated at speed 1 since the driver first started. */
let clock = 0;

/** The shared clock — new subscribers seed their local time from this. */
export function sharedClock(): number {
  return clock;
}

function frame(now: number): void {
  // clamp dt so a backgrounded tab or a breakpoint doesn't fling the
  // animation forward on resume
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  // iterate a copy: a tick may unsubscribe (e.g. an orb unmounting)
  for (const fn of Array.from(subs)) fn(dt);
  if (subs.size > 0) raf = requestAnimationFrame(frame);
  else raf = 0;
}

export function subscribe(fn: Tick): () => void {
  subs.add(fn);
  if (raf === 0 && typeof requestAnimationFrame !== 'undefined') {
    last = typeof performance !== 'undefined' ? performance.now() : 0;
    raf = requestAnimationFrame(frame);
  }
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
