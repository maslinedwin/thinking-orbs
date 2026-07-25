// Theme resolution: explicit prop → ancestor data-theme/.dark|.light class
// (watched live) → prefers-color-scheme (subscribed live).
//
// Upstream gave EVERY instance its own document-wide MutationObserver with
// `subtree: true` — 20 inline orbs meant 20 whole-document observers, each
// firing on any class toggle anywhere in the app. Here one shared observer and
// one shared matchMedia listener fan out to all subscribers.
//
// Upstream also defaulted `useState(true)`, so on a light-background app the
// first painted frame was inverted before an effect corrected it. The theme is
// now resolved synchronously on first client render via useSyncExternalStore.

import { useCallback, useSyncExternalStore } from 'react';
import type { OrbTheme } from './types';

function ancestorTheme(el: Element | null): boolean | null {
  let node: Element | null = el;
  while (node) {
    const attr = node.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    if (node.classList.contains('dark')) return true;
    if (node.classList.contains('light')) return false;
    node = node.parentElement;
  }
  return null;
}

function systemDark(): boolean {
  return typeof matchMedia === 'undefined' || matchMedia('(prefers-color-scheme: dark)').matches;
}

// --- one shared listener set for the whole page ------------------------

type Listener = () => void;
const listeners = new Set<Listener>();
let mo: MutationObserver | null = null;
let mq: MediaQueryList | null = null;
let mqHandler: (() => void) | null = null;

function notify(): void {
  for (const fn of Array.from(listeners)) fn();
}

function attach(): void {
  if (typeof document === 'undefined') return;
  if (!mo && typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(notify);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
      subtree: true
    });
  }
  if (!mq && typeof matchMedia !== 'undefined') {
    mq = matchMedia('(prefers-color-scheme: dark)');
    mqHandler = notify;
    mq.addEventListener('change', mqHandler);
  }
}

function detach(): void {
  if (listeners.size > 0) return;
  mo?.disconnect();
  mo = null;
  if (mq && mqHandler) mq.removeEventListener('change', mqHandler);
  mq = null;
  mqHandler = null;
}

function subscribeTheme(fn: Listener): () => void {
  listeners.add(fn);
  attach();
  return () => {
    listeners.delete(fn);
    detach();
  };
}

const noopUnsub = () => {};

/** Resolve the effective dark/light substrate for a mounted element. */
export function useResolvedDark(theme: OrbTheme, hostRef: { current: Element | null }): boolean {
  const subscribe = useCallback(
    (fn: () => void) => (theme === 'auto' ? subscribeTheme(fn) : noopUnsub),
    [theme]
  );

  const getSnapshot = useCallback(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    if (typeof document === 'undefined') return true;
    return ancestorTheme(hostRef.current) ?? systemDark();
  }, [theme, hostRef]);

  // SSR: no DOM to read, so assume dark. The canvas paints client-side only,
  // and the first client render re-reads the real value before any paint.
  const getServerSnapshot = useCallback(() => theme !== 'light', [theme]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// --- reduced motion ----------------------------------------------------

const rmListeners = new Set<Listener>();
let rmMq: MediaQueryList | null = null;
let rmHandler: (() => void) | null = null;

function subscribeReduced(fn: Listener): () => void {
  rmListeners.add(fn);
  if (!rmMq && typeof matchMedia !== 'undefined') {
    rmMq = matchMedia('(prefers-reduced-motion: reduce)');
    rmHandler = () => {
      for (const l of Array.from(rmListeners)) l();
    };
    rmMq.addEventListener('change', rmHandler);
  }
  return () => {
    rmListeners.delete(fn);
    if (rmListeners.size === 0 && rmMq && rmHandler) {
      rmMq.removeEventListener('change', rmHandler);
      rmMq = null;
      rmHandler = null;
    }
  };
}

const reducedSnapshot = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const reducedServerSnapshot = () => false;

/** Live `prefers-reduced-motion` — reduced users get a static frame. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, reducedSnapshot, reducedServerSnapshot);
}
