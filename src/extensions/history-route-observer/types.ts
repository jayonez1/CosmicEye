/** Navigation action type emitted by the observer. */
export type NavigationAction = 'PUSH' | 'REPLACE' | 'POP' | 'INIT';

/** Event emitted on every navigation change. */
export interface NavigationEvent {
  pathname: string;
  search: string;
  action: NavigationAction;
}

/** Callback signature for navigation listeners. */
export type NavigationListener = (event: NavigationEvent) => void;

/** Minimal history-like object accepted by observeHistory. Works with history v4 and v5. */
export interface HistoryLike {
  push: (path: string | Partial<HistoryLocation>, state?: unknown) => void;
  replace: (path: string | Partial<HistoryLocation>, state?: unknown) => void;
  listen: (callback: (...args: unknown[]) => void) => (() => void) | void;
  location: HistoryLocation;
}

/** Location shape used in HistoryLike. */
export interface HistoryLocation {
  pathname: string;
  search?: string;
}

/** Observer instance returned by observeHistory. */
export interface HistoryRouteObserver {
  /** Subscribe a listener to navigation events. Returns an unsubscribe function. */
  subscribe: (listener: NavigationListener) => () => void;
  /** Remove history patches, call unlisten, clear all listeners and state. */
  unpatch: () => void;
}
