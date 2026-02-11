// Shared utilities barrel — used by rdr, rt, and extensions

export { nowMs, elapsedMs } from './time';
export { env } from './env';
export { shouldEnableSample, getClientId } from './sampling';
export { generateId } from './generate-id';
export { dispatchExtensionEvent } from './chrome-ext';
export { collectEnrichers, DEFAULT_ENRICHER_LIMITS } from './enrichers';
export {
  hashText,
  hashStructuredData,
  makeRpcRequestKey,
  makeRequestKey,
  makeHttpRequestKey,
  DEFAULT_HASH_LIMITS,
} from './hash';

export type {
  Enricher,
  EnricherLimitsConfig,
  EnvSnapshot,
  NetworkInformation,
  NavigatorWithConnection,
  SamplingConfig,
  RequestKeyResult,
  StructuredHashResult,
  HashLimitsConfig,
} from './types';
