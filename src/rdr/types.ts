/** Payload from an API request message (e.g. from window.postMessage). */
export interface ApiRequestPayload {
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

/** Result of makeRequestKey — identifies a unique request. */
export interface RequestKeyResult {
  endpoint: string;
  reqHash: string;
}

/** Result of _hashStructuredData. */
export interface StructuredHashResult {
  hashHex: string;
  wasTruncated: boolean;
  nodesVisited: number;
}

/** Hash limits configuration. */
export interface HashLimitsConfig {
  readonly MAX_DEPTH: number;
  readonly MAX_NODES: number;
  readonly MAX_OBJECT_KEYS: number;
  readonly MAX_ARRAY_ITEMS: number;
  readonly MAX_STRING_CHARS: number;
}

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

/** Environment snapshot. */
export interface EnvSnapshot {
  visibility: string;
  net: { effectiveType: string | null } | null;
}

/** Log entry written to the queue on duplicate detection. */
export interface LogEntry {
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
  mobx?: unknown;
}

/**
 * NetworkInformation interface — partial definition for navigator.connection.
 * Not available in all browsers; guarded at runtime.
 */
export interface NetworkInformation {
  effectiveType?: string;
}

/** Extends Navigator for connection-related vendor-prefixed properties. */
export interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}
