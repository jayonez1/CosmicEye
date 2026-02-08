/** Internal transition state tracked by the RT module. */
export interface Transition {
  id: string;
  startAt: number;
  renderedAt: number | null;
  interactiveAt: number | null;
  pathname: string;
  search: string;
  routeName: string;
  pendingCritical: number;
  aborted: boolean;
  timedOut: boolean;
  sent: boolean;
}

/** Log entry emitted when a route transition completes. */
export interface RTLogEntry {
  ver: string;
  id: string;
  routeName: string;
  pathname: string;
  routeRenderMs: number | null;
  routeTtiMs: number | null;
  search?: string;
  timedOut?: boolean;
}

/** Minimal history-like object accepted by patchHistory. Works with history v4 and v5. */
export interface HistoryLike {
  push: (path: string | Partial<HistoryLocation>, state?: unknown) => void;
  replace: (path: string | Partial<HistoryLocation>, state?: unknown) => void;
  listen: (callback: (...args: unknown[]) => void) => (() => void) | void;
}

/** Location shape used in HistoryLike. */
export interface HistoryLocation {
  pathname: string;
  search?: string;
}
