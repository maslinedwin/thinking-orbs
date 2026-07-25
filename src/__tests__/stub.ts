// A recording 2D-context stub.
//
// The engine is fully deterministic (hashD, never Math.random), so capturing
// the draw-op sequence and snapshotting it locks the hand-tuned presets against
// regression — which matters now that size resolution interpolates them. No
// native node-canvas dependency needed.

export interface RecCtx {
  ops: string[];
  arcs: number;
  fills: number;
  styleWrites: number;
  styles: string[];
  setTransform(): void;
  clearRect(): void;
  beginPath(): void;
  moveTo(): void;
  fill(): void;
  arc(x: number, y: number, r: number): void;
  fillStyle: string;
}

export function recCtx(): RecCtx {
  let cur = '';
  const c: RecCtx = {
    ops: [],
    arcs: 0,
    fills: 0,
    styleWrites: 0,
    styles: [],
    setTransform() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    fill() {
      c.fills++;
    },
    arc(x: number, y: number, r: number) {
      c.arcs++;
      // 2 decimals: enough to catch geometry drift, loose enough that trivial
      // float noise doesn't churn the snapshots
      c.ops.push(`${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)},${cur}`);
    },
    get fillStyle() {
      return cur;
    },
    set fillStyle(v: string) {
      c.styleWrites++;
      c.styles.push(v);
      cur = v;
    }
  };
  return c;
}

/** Short stable digest of a recorded frame, for compact snapshots. */
export function digest(ops: string[]): string {
  let h = 2166136261;
  for (const op of ops) {
    for (let i = 0; i < op.length; i++) {
      h ^= op.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
