/** Enricher definition — sync getter called during payload formation. */
export interface Enricher {
  name: string;
  get: (nowMs: number) => unknown;
}

/** Limits applied to enricher output serialization. */
export interface EnricherLimitsConfig {
  readonly maxDepth: number;
  readonly maxStringChars: number;
}

/** Environment snapshot. */
export interface EnvSnapshot {
  visibility: string;
  net: { effectiveType: string | null } | null;
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

/** Synchronous sampling decision. Replaces random sampling; only true enables collection. */
export type SamplingFn = (samplingRate: number) => boolean;

/** Sampling configuration accepted by the shared sampling function. */
export interface SamplingConfig {
  rate: number;
  samplingFn?: SamplingFn;
}

/** Result of makeRpcRequestKey / makeHttpRequestKey — identifies a unique request. */
export interface RequestKeyResult {
  endpoint: string;
  reqHash: string;
}

/** Result of hashStructuredData. */
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
