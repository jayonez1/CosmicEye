/** Log schema version. NOT changeable via config — this is a contract. */
export const VERSION = '0.1';

/** Chrome extension event name for RDR. */
export const CHROME_EXT_EVENT_NAME = 'rdr';

// ─── Defaults (used when config does not override) ───

export const DEFAULTS = {
  SAMPLING_RATE: 0.05,
  SAMPLING_STORAGE_KEY: 'rum_user_id',
  DUPLICATE_THRESHOLD_MS: 1_000,
  CLEANUP_INTERVAL_MS: 10_000,
  FLUSH_INTERVAL_MS: 15_000,
  FLUSH_MAX_EVENTS: 50,
  ACTIONS_BUFFER_MAX_SIZE: 3,
  ACTIONS_TRACKED_EVENTS: ['click', 'keydown', 'touchstart'] as readonly string[],
} as const;
