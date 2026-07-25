// Native theme + reduced-motion resolution.
//
// The web version resolves `auto` in three layers: an ancestor
// `data-theme`/`.dark` attribute, then `prefers-color-scheme`. There is no DOM
// ancestor to walk here, so `auto` means the system colour scheme and nothing
// else — if a screen needs to override it, pass `theme` explicitly. Worth
// knowing rather than discovering: a light-themed screen inside a dark app will
// NOT be detected automatically the way it is on web.
//
// Both hooks share one subscription each for the whole app, matching the web
// shell's single-observer design.

import { useCallback, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Appearance } from 'react-native';
import type { OrbTheme } from '../types';

type Listener = () => void;

// --- colour scheme -----------------------------------------------------

const themeListeners = new Set<Listener>();
let themeSub: { remove: () => void } | null = null;

function subscribeTheme(fn: Listener): () => void {
  themeListeners.add(fn);
  if (!themeSub) {
    themeSub = Appearance.addChangeListener(() => {
      for (const l of Array.from(themeListeners)) l();
    });
  }
  return () => {
    themeListeners.delete(fn);
    if (themeListeners.size === 0) {
      themeSub?.remove();
      themeSub = null;
    }
  };
}

const noop = () => () => {};

/** Effective dark/light substrate. `auto` follows the system colour scheme. */
export function useResolvedDark(theme: OrbTheme): boolean {
  const subscribe = useCallback(
    (fn: Listener) => (theme === 'auto' ? subscribeTheme(fn) : noop()),
    [theme]
  );
  const snapshot = useCallback(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    // default to dark when the platform reports null — Nowah is a dark app, and
    // a bright orb on an unknown substrate is the safer failure
    return Appearance.getColorScheme() !== 'light';
  }, [theme]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// --- reduced motion ----------------------------------------------------
//
// Unlike matchMedia, AccessibilityInfo.isReduceMotionEnabled() is ASYNC, so
// there's no synchronous snapshot to give useSyncExternalStore. The value is
// cached in a module-level variable that the subscription primes and then keeps
// current; the first render reports false and corrects itself once the platform
// answers. That's the right way round — briefly animating for a
// reduce-motion user is better than briefly freezing for everyone else.

const rmListeners = new Set<Listener>();
let rmSub: { remove: () => void } | null = null;
let rmValue = false;
let rmPrimed = false;

function subscribeReduced(fn: Listener): () => void {
  rmListeners.add(fn);
  if (!rmSub) {
    rmSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      rmValue = enabled;
      for (const l of Array.from(rmListeners)) l();
    });
  }
  if (!rmPrimed) {
    rmPrimed = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (enabled !== rmValue) {
        rmValue = enabled;
        for (const l of Array.from(rmListeners)) l();
      }
    });
  }
  return () => {
    rmListeners.delete(fn);
    if (rmListeners.size === 0) {
      rmSub?.remove();
      rmSub = null;
    }
  };
}

const rmSnapshot = () => rmValue;

/** Live reduce-motion preference. Reduced users get a single static frame. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, rmSnapshot, rmSnapshot);
}
