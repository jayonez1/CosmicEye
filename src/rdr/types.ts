import type {
  Enricher,
  EnricherLimitsConfig,
  EnvSnapshot,
  HashLimitsConfig,
  RequestKeyResult,
  SamplingFn,
} from '../shared/types';

// Re-export shared types used by consumers
export type {
  SamplingFn,
  EnvSnapshot,
  HashLimitsConfig,
  RequestKeyResult,
  StructuredHashResult,
  Enricher,
  EnricherLimitsConfig,
} from '../shared/types';

// ─── RPC payload ───

/** Payload from an RPC-style API request message (e.g. from window.postMessage). */
export interface RpcRequestPayload {
  /** Service name */
  s?: string;
  /** Method name */
  m?: string;
  /** Request params (arbitrary structure, only hashed — never stored raw) */
  p?: unknown;
  /** Request body (arbitrary structure, only hashed — never stored raw) */
  b?: unknown;
  /** Oneway flag */
  o?: boolean;
  /** Timeout */
  t?: number;
}

// ─── HTTP payload ───

/** Payload for an HTTP-style request. */
export interface HttpRequestPayload {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  httpMethod: string;
  /** Full endpoint URL string */
  endpoint: string;
  /** Request body as text (will be hashed, not stored raw) */
  bodyText?: string;
}

// ─── Action tracking ───

/** Snapshot of the last user action. */
export interface ActionData {
  type: string;
  rum_id?: string;
}

/** Full action snapshot returned by actions.snapshot(). */
export interface ActionSnapshot {
  lastAction: ActionData | null;
  timeSinceLastActionMs: number | null;
}

// ─── Log entry ───

/** Log entry written to the queue on duplicate detection. */
export interface RdrLogEntry {
  ver: string;
  endpoint: string;
  reqHash: string;
  deltaMs: number;
  timings: {
    timeSincePageLoadMs: number;
    timeSinceLastActionMs: number | null;
  };
  lastAction: ActionData | null;
  env: EnvSnapshot;
  tag?: string;
  enrichments?: Record<string, unknown>;
}

// ─── Flush payload ───

/** Payload passed to the send function on flush. */
export interface RdrFlushPayload {
  trigger: string;
  meta?: unknown;
  entries: RdrLogEntry[];
}

// ─── Send function ───

/** Custom send function for RDR flush results. */
export type RdrSendFn = (payload: RdrFlushPayload) => void;

// ─── Config ───

/** Custom key factory — must return an object with endpoint + reqHash. */
export type RdrKeyFactory = (payload: unknown) => RequestKeyResult;

/** RDR initialization config. */
export interface RdrConfig {
  /** Page-load sampling rate (0..1). Default: 1. Passed to samplingFn when provided. */
  samplingRate?: number;
  /** Sync override, called once per page load even at rates 0/1. Throws disable collection. */
  samplingFn?: SamplingFn;
  /** Duplicate detection time window in ms. Default: 1000. */
  duplicateThresholdMs?: number;
  /** Cleanup interval for stale entries in ms. Default: 10000. */
  cleanupIntervalMs?: number;
  /** Flush interval in ms. Default: 15000. */
  flushIntervalMs?: number;
  /** Max events before auto-flush. Default: 50. */
  flushMaxEvents?: number;
  /** Hash limits for structured data. */
  hashLimits?: Partial<HashLimitsConfig>;
  /** Custom send function. If not set, falls back to console.log. */
  send?: RdrSendFn;
  /** Custom key factory for RPC requests. Overrides default makeRpcRequestKey. */
  rpcKeyFactory?: RdrKeyFactory;
  /** Custom key factory for HTTP requests. Overrides default makeHttpRequestKey. */
  httpKeyFactory?: RdrKeyFactory;
  /** Enrichers — sync getters called during payload formation. */
  enrichers?: Enricher[];
  /** Enricher output limits. */
  enricherLimits?: Partial<EnricherLimitsConfig>;
  /** Custom metric tag added to every log entry. */
  tag?: string;
  /** Enable chrome extension events (dispatches CustomEvent with name 'rdr'). Default: false. */
  chromeExtensionEvents?: boolean;
  /** Max size of the user action buffer. Default: 3. */
  actionsBufferMaxSize?: number;
  /** Event types to track for user actions. Default: ['click', 'keydown', 'touchstart']. */
  actionsTrackedEvents?: string[];
}

// ─── Result types ───

/** Result of rdr.flush(). */
export interface RdrFlushResult {
  initialized: boolean;
  flushed: boolean;
  entriesCount: number;
}

/** Result of rdr.reqHandlerRpc() / rdr.reqHandlerHttp(). */
export interface RdrReqHandlerResult {
  initialized: boolean;
  processed: boolean;
  duplicate: boolean;
}

/** Result of rdr.resetTiming(). */
export interface RdrResetTimingResult {
  initialized: boolean;
  reset: boolean;
}

/** Result of rdr.resetActions(). */
export interface RdrResetActionsResult {
  initialized: boolean;
  reset: boolean;
}

/** Result of rdr.destroy(). */
export interface RdrDestroyResult {
  initialized: boolean;
  destroyed: boolean;
}
