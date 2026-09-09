import type {
  HistoryLike,
  HistoryLocation,
  HistoryRouteObserver,
  NavigationEvent,
  NavigationListener,
} from './types';

/** WeakMap ensures idempotency — one observer per history object. */
const observers = new WeakMap<HistoryLike, HistoryRouteObserver>();

/**
 * Parse string or object location into { pathname, search }.
 * Pure helper — no side effects, no imports from RT/RDR.
 */
const parseLocation = (
  pathOrLocation: string | Partial<HistoryLocation>,
  fallbackPathname: string,
): { pathname: string; search: string } => {
  if (typeof pathOrLocation === 'string') {
    try {
      // Query/hash-only navigation keeps the current pathname.
      const base = /^[?#]/.test(pathOrLocation)
        ? new URL(fallbackPathname, 'http://localhost')
        : 'http://localhost';
      const url = new URL(pathOrLocation, base);
      return { pathname: url.pathname, search: url.search };
    } catch {
      return { pathname: pathOrLocation, search: '' };
    }
  }

  if (pathOrLocation && typeof pathOrLocation === 'object') {
    return {
      pathname: pathOrLocation.pathname || fallbackPathname,
      search: pathOrLocation.search || '',
    };
  }

  return { pathname: fallbackPathname, search: '' };
};

/**
 * Observe navigation events on a history-like object.
 *
 * - Patches `push` and `replace` to emit PUSH/REPLACE events **before** the original call.
 * - Subscribes to `history.listen` to catch POP (back/forward) events.
 * - Emits a single INIT event on first subscription.
 * - Idempotent via WeakMap — calling again with the same history returns the same observer.
 * - Fully neutral: no imports from RT or RDR.
 *
 * @example
 * ```ts
 * import { observeHistory } from 'cosmic-eye';
 *
 * const observer = observeHistory(history);
 * const unsub = observer.subscribe(({ pathname, search, action }) => {
 *   console.log(action, pathname, search);
 * });
 * // later:
 * unsub();
 * observer.unpatch();
 * ```
 */
export function observeHistory(history: HistoryLike): HistoryRouteObserver {
  const existing = observers.get(history);

  if (existing) {
    return existing;
  }

  const listeners = new Set<NavigationListener>();
  let destroyed = false;

  const emit = (event: NavigationEvent): void => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (_) {
        // listener errors must not break the observer
      }
    }
  };

  // --- Patch push ---
  const originalPush = history.push.bind(history);

  history.push = (pathOrLocation: string | Partial<HistoryLocation>, state?: unknown) => {
    if (!destroyed) {
      const { pathname, search } = parseLocation(pathOrLocation, history.location.pathname);
      emit({ pathname, search, action: 'PUSH' });
    }
    return originalPush(pathOrLocation, state);
  };

  // --- Patch replace ---
  const originalReplace = history.replace.bind(history);

  history.replace = (pathOrLocation: string | Partial<HistoryLocation>, state?: unknown) => {
    if (!destroyed) {
      const { pathname, search } = parseLocation(pathOrLocation, history.location.pathname);
      emit({ pathname, search, action: 'REPLACE' });
    }
    return originalReplace(pathOrLocation, state);
  };

  // --- Listen for POP (back/forward) only ---
  // PUSH and REPLACE are already emitted by patched methods above.
  // history.listen fires for ALL actions, so we filter to POP only to avoid duplicates.
  let unlisten: (() => void) | void;

  unlisten = history.listen((...args: unknown[]) => {
    if (destroyed) {
      return;
    }

    let location: HistoryLocation;
    let action: string;

    if (args.length >= 2 && typeof args[1] === 'string') {
      // history v4: callback(location, action)
      location = args[0] as HistoryLocation;
      action = args[1];
    } else if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      // history v5: callback({ location, action })
      const update = args[0] as { location: HistoryLocation; action: string };
      location = update.location;
      action = update.action;
    } else {
      return;
    }

    // Only emit POP — PUSH/REPLACE are handled by patched methods
    if (action !== 'POP') {
      return;
    }

    emit({
      pathname: location.pathname,
      search: location.search || '',
      action: 'POP',
    });
  });

  // --- INIT event emitted once on first subscribe ---
  let initEmitted = false;

  const subscribe = (listener: NavigationListener): (() => void) => {
    listeners.add(listener);

    if (!initEmitted && !destroyed) {
      initEmitted = true;
      const { pathname, search } = history.location;
      emit({ pathname, search: search || '', action: 'INIT' });
    }

    return () => {
      listeners.delete(listener);
    };
  };

  const unpatch = (): void => {
    if (destroyed) {
      return;
    }

    destroyed = true;

    // Restore original methods
    history.push = originalPush;
    history.replace = originalReplace;

    // Call unlisten if available
    if (typeof unlisten === 'function') {
      unlisten();
      unlisten = undefined;
    }

    // Clear listeners
    listeners.clear();

    // Remove from WeakMap so a fresh observer can be created later
    observers.delete(history);
  };

  const observer: HistoryRouteObserver = { subscribe, unpatch };

  observers.set(history, observer);

  return observer;
}

export type {
  HistoryLike,
  HistoryLocation,
  HistoryRouteObserver,
  NavigationAction,
  NavigationEvent,
  NavigationListener,
} from './types';
