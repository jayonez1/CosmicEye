import type { Enricher, EnricherLimitsConfig } from '../shared/types';

// Re-export shared types used by consumers
export type { Enricher, EnricherLimitsConfig } from '../shared/types';

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
  routeRenderMs: number | null;
  routeTtiMs: number | null;
  pathname?: string;
  search?: string;
  timedOut?: boolean;
  aborted?: boolean;
  abortReason?: string;
  tag?: string;
  enrichments?: Record<string, unknown>;
}

/** Payload passed to the send function. */
export interface RtEventPayload {
  type: 'transition' | 'abort';
  entry: RTLogEntry;
}

/** Custom send function for RT events. */
export type RtSendFn = (payload: RtEventPayload) => void;

/** RT initialization config. */
export interface RtConfig {
  /** Sampling rate (0..1). 1 = always enabled. Default: 0.05. */
  samplingRate?: number;
  /** localStorage key for persisting client ID. Default: 'rum_rt_id'. */
  samplingStorageKey?: string;
  /** Explicit client ID for sampling. Overrides localStorage. */
  clientId?: string;
  /** Critical timeout in ms. Default: 20000. */
  criticalTimeoutMs?: number;
  /** Idle timeout in ms. Default: 1500. */
  idleTimeoutMs?: number;
  /** Number of requestAnimationFrame calls before idle check. Default: 2. */
  rafCount?: number;
  /** Include pathname in payload. Default: false. */
  includePathname?: boolean;
  /** Include search in payload. Default: false. */
  includeSearch?: boolean;
  /** Custom send function. If not set, falls back to console.log. */
  send?: RtSendFn;
  /** Enrichers — sync getters called during payload formation. */
  enrichers?: Enricher[];
  /** Enricher output limits. */
  enricherLimits?: Partial<EnricherLimitsConfig>;
  /** Custom metric tag added to every log entry. */
  tag?: string;
  /** Enable chrome extension events (dispatches CustomEvent with name 'rt'). Default: false. */
  chromeExtensionEvents?: boolean;
}

// ─── Result types ───

/** Result of rt.startTransition(). */
export interface RtStartTransitionResult {
  initialized: boolean;
  started: boolean;
}

/** Result of rt.markRendered(). */
export interface RtMarkRenderedResult {
  initialized: boolean;
  marked: boolean;
}

/** Result of rt.trackCritical(). */
export interface RtTrackCriticalResult {
  initialized: boolean;
  tracked: boolean;
  done?: () => void;
}

/** Result of rt.abortPending(). */
export interface RtAbortPendingResult {
  initialized: boolean;
  aborted: boolean;
}

/** Result of rt.destroy(). */
export interface RtDestroyResult {
  initialized: boolean;
  destroyed: boolean;
}
