// Public API — re-exports only, no logic or side-effects

export { initRDR, hashText, makeRequestKey, VERSION } from './rdr';
export { default } from './rdr';

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
