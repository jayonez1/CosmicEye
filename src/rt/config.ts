/** Log schema version. NOT changeable via config — this is a contract. */
export const VERSION = '0.1';

/** Chrome extension event name for RT. */
export const CHROME_EXT_EVENT_NAME = 'rt';

/** Console log event name. */
export const EVENT_NAME = 'cosmic_eye_route_transition';

/** Regex for normalizing numeric path segments to :id. */
export const NORMALIZE_ID_REGEX = /\/\d+/g;

// ─── Defaults (used when config does not override) ───

export const DEFAULTS = {
  SAMPLING_RATE: 0.05,
  SAMPLING_STORAGE_KEY: 'rum_rt_id',
  CRITICAL_TIMEOUT_MS: 20_000,
  IDLE_TIMEOUT_MS: 1_500,
  RAF_COUNT: 2,
} as const;
