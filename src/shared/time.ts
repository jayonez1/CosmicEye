/** Shared time utilities used by rdr, rt, and extensions. All values in milliseconds. */

/**
 * Current high-resolution timestamp in milliseconds.
 * Uses performance.now() when available, falls back to Date.now().
 * Result is always rounded to the nearest integer.
 */
export const nowMs = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return Math.round(performance.now());
  }

  return Date.now();
};

/**
 * Elapsed time in milliseconds since a given timestamp.
 * Both `since` and the result are rounded integers.
 */
export const elapsedMs = (since: number): number => {
  const current = nowMs();
  const sinceRounded = typeof since === 'number' ? Math.round(since) : 0;

  return current - sinceRounded;
};
