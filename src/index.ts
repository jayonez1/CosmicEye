// Public API — re-exports only, no logic or side-effects
// NOTE: React extensions are in a separate entry point 'cosmic-eye/react'

// === RDR ===
export { initRDR } from './rdr';
export { default as rdr } from './rdr';

export type {
  RpcRequestPayload,
  HttpRequestPayload,
  RdrLogEntry,
  RdrFlushPayload,
  RdrSendFn,
  RdrKeyFactory,
  RdrConfig,
  RdrFlushResult,
  RdrReqHandlerResult,
  RdrResetTimingResult,
  RdrResetActionsResult,
  RdrDestroyResult,
  ActionData,
  ActionSnapshot,
} from './rdr';

// === RT ===
export { initRT, trackCritical } from './rt';
export { default as rt } from './rt';

export type {
  Transition,
  RTLogEntry,
  RtEventPayload,
  RtSendFn,
  RtConfig,
  RtStartTransitionResult,
  RtMarkRenderedResult,
  RtTrackCriticalResult,
  RtAbortPendingResult,
  RtDestroyResult,
} from './rt';

// === Shared public utils ===
export { hashText, makeRpcRequestKey, makeHttpRequestKey } from './shared/hash';

export type {
  RequestKeyResult,
  StructuredHashResult,
  HashLimitsConfig,
  EnvSnapshot,
  Enricher,
  EnricherLimitsConfig,
  SamplingFn,
} from './shared/types';

// === Extensions (non-React) ===
// Also available from 'cosmic-eye/extensions'.
export { observeHistory, mobxSpy } from './extensions';

export type {
  HistoryLike,
  HistoryLocation,
  HistoryRouteObserver,
  NavigationAction,
  NavigationEvent,
  NavigationListener,
  MobxSpySnapshot,
  MobxSpyConfig,
  MobxActionEntry,
  MobxReactionEntry,
} from './extensions';
