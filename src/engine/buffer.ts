// Pooled dot buffer.
//
// Upstream allocated a fresh `Dot[]` every frame and sorted it — 566 objects
// per frame on composing@64, ~34k object allocations/sec/orb. Here the pool
// only ever grows: dots are reused in place and `n` tracks how many are live.
//
// Sorting can't happen on the pool directly (JS can't sort a subrange, and
// truncating `length` would discard pooled objects), so we sort a reusable
// index array by z instead and walk dots through that.

import type { Dot } from './core';

export class DotBuffer {
  /** Grow-only pool. Entries past `n` are stale — never read them. */
  dots: Dot[] = [];
  /** Live dot count. */
  n = 0;
  /** Reusable z-order index; valid for [0, n) after `sortByZ()`. */
  order: number[] = [];

  /** Drop all live dots without releasing the pool. */
  reset(): void {
    this.n = 0;
  }

  /**
   * Claim the next dot. Returns a pooled object to write into — callers must
   * set every field, since values from previous frames persist.
   */
  next(): Dot {
    const i = this.n++;
    let d = this.dots[i];
    if (d === undefined) {
      d = { x: 0, y: 0, z: 0, r: 0, white: 0, a: 1 };
      this.dots[i] = d;
    }
    return d;
  }

  /** Push a fully-specified dot. */
  add(x: number, y: number, z: number, r: number, white: number, a = 1): void {
    const d = this.next();
    d.x = x;
    d.y = y;
    d.z = z;
    d.r = r;
    d.white = white;
    d.a = a;
  }

  /**
   * Sort `order` far→near. Painters rely on this for correct overlap.
   *
   * `order` is a persistent plain array so the sort is in place and allocates
   * nothing per frame — a typed array can't take a comparator that reads the
   * dot pool, and slicing one into a fresh array each frame would reintroduce
   * exactly the garbage this buffer exists to avoid.
   */
  sortByZ(): void {
    const n = this.n;
    const order = this.order;
    order.length = n;
    for (let i = 0; i < n; i++) order[i] = i;
    const dots = this.dots;
    order.sort((a, b) => dots[a].z - dots[b].z);
  }
}
