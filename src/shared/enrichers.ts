import { nowMs } from './time';
import type { Enricher, EnricherLimitsConfig } from './types';

export const DEFAULT_ENRICHER_LIMITS: EnricherLimitsConfig = {
  maxDepth: 5,
  maxStringChars: 1_024,
} as const;

/**
 * Run all enrichers and collect results into a record.
 * Each getter is called synchronously with try/catch.
 * If a getter throws, the entry is set to `{ error: 'enricher_failed' }`.
 * Output values are truncated according to limits.
 */
export const collectEnrichers = (
  enrichers: Enricher[] | undefined,
  limits: EnricherLimitsConfig = DEFAULT_ENRICHER_LIMITS,
): Record<string, unknown> | undefined => {
  if (!enrichers || enrichers.length === 0) {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  const currentTime = nowMs();

  for (const enricher of enrichers) {
    try {
      const value = enricher.get(currentTime);
      result[enricher.name] = truncateValue(value, limits.maxDepth, limits.maxStringChars, 0);
    } catch (_) {
      result[enricher.name] = { error: 'enricher_failed' };
    }
  }

  return result;
};

/** Recursively truncate a value to enforce depth and string limits. */
const truncateValue = (
  value: unknown,
  maxDepth: number,
  maxStringChars: number,
  depth: number,
): unknown => {
  if (depth > maxDepth) {
    return '[maxDepth]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  const type = typeof value;

  if (type === 'string') {
    const str = value as string;
    return str.length > maxStringChars ? str.slice(0, maxStringChars) + '...' : str;
  }

  if (type === 'number' || type === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => truncateValue(item, maxDepth, maxStringChars, depth + 1));
  }

  if (type === 'object') {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = truncateValue(
        (value as Record<string, unknown>)[key],
        maxDepth,
        maxStringChars,
        depth + 1,
      );
    }

    return result;
  }

  return String(value);
};
