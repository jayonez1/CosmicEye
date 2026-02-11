import { hashText } from './hash';
import type { SamplingConfig } from './types';

/**
 * Determine whether a client should be sampled, based on config.
 * Fully config-driven — no implicit dev exceptions.
 *
 * @param config.rate — sampling rate (0..1). 1 = always enabled, 0 = always disabled.
 * @param config.storageKey — localStorage key for persisting client ID.
 * @param config.clientId — optional explicit client ID (overrides localStorage).
 * @returns true if this client is sampled.
 */
export const shouldEnableSample = (config: SamplingConfig): boolean => {
  try {
    if (config.rate >= 1) {
      return true;
    }

    if (config.rate <= 0) {
      return false;
    }

    const id = getClientId(config);
    const h = hashText(id);
    const bucket = (parseInt(h, 16) % 10_000) / 10_000;

    return bucket < config.rate;
  } catch (_) {
    return false;
  }
};

/**
 * Resolve client ID: explicit config > localStorage > generate new.
 */
export const getClientId = (config: SamplingConfig): string => {
  if (config.clientId) {
    return config.clientId;
  }

  try {
    const stored = localStorage.getItem(config.storageKey);

    if (stored) {
      return stored;
    }

    const generated = crypto?.randomUUID?.() || String(Math.random()) + String(Date.now());
    localStorage.setItem(config.storageKey, generated);

    return generated;
  } catch (_) {
    return String(Math.random()) + String(Date.now());
  }
};
