export const VERSION = '0.1';

export const IS_DEV = process.env.NODE_ENV !== 'production';

export const CRITICAL_TIMEOUT_MS = 20_000;

export const IDLE_TIMEOUT_MS = 1_500;

export const RAF_COUNT = 2;

export const EVENT_NAME = 'cosmic_eye_route_transition';

export const NORMALIZE_ID_REGEX = /\/\d+/g;
