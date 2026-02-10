// Public API — re-exports only, no logic or side-effects
// NOTE: React extensions are in a separate entry point 'cosmic-eye/react'

// === RDR ===
export { initRDR, hashText, makeRequestKey } from './rdr';
export { default as rdr } from './rdr';

export type {
  ApiRequestPayload,
  LogEntry,
  RequestKeyResult,
  StructuredHashResult,
  HashLimitsConfig,
  ActionData,
  ActionSnapshot,
  EnvSnapshot,
} from './rdr';

// === RT ===
export { initRT, trackCritical } from './rt';
export { default as rt } from './rt';

export type {
  Transition,
  RTLogEntry,
} from './rt';

// === Extensions (non-React) ===
export { observeHistory } from './extensions';

export type {
  HistoryLike,
  HistoryLocation,
  HistoryRouteObserver,
  NavigationAction,
  NavigationEvent,
  NavigationListener,
} from './extensions';
