export const VERSION = '0.1';

export const IS_DEV = process.env.NODE_ENV !== 'production';

export const SAMPLING = {
  RATE: 0.05,
  STORAGE_KEY: 'rum_user_id',
} as const;

export const TIMINGS = {
  DUPLICATE_THRESHOLD_MS: 1_000,
  CLEANUP_INTERVAL_MS: 10_000,
} as const;

export const FLUSH = {
  INTERVAL_MS: 15_000,
  MAX_EVENTS: 50,
} as const;

export const HASH_LIMITS = {
  MAX_DEPTH: 20,
  MAX_NODES: 5_000,
  MAX_OBJECT_KEYS: 300,
  MAX_ARRAY_ITEMS: 1_000,
  MAX_STRING_CHARS: 2_048,
} as const;

export const ACTIONS = {
  BUFFER_MAX_SIZE: 3,
  TRACKED_EVENTS: ['click', 'keydown', 'touchstart'] as readonly string[],
} as const;

export const CHROME_EXT = {
  EVENT_NAME: '__RDR_LOG__',
} as const;
