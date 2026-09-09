import type { SamplingConfig } from './types';

/**
 * Make a sampling decision without accessing storage.
 * Each module retains the result for its lifetime, including across destroy/init.
 * A custom function replaces random sampling, including at rates 0 and 1.
 */
export const shouldEnableSample = (config: SamplingConfig): boolean => {
  try {
    if (!Number.isFinite(config.rate) || config.rate < 0 || config.rate > 1) {
      return false;
    }

    if (config.samplingFn !== undefined) {
      return config.samplingFn(config.rate) === true;
    }

    return Math.random() < config.rate;
  } catch (_) {
    return false;
  }
};
