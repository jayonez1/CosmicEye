import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldEnableSample, _resetSamplingState } from '../../src/rdr/sampling';

beforeEach(() => {
  _resetSamplingState();
  localStorage.clear();
});

describe('shouldEnableSample', () => {
  it('returns a stable boolean on repeated calls', () => {
    const first = shouldEnableSample();
    const second = shouldEnableSample();
    expect(first).toBe(second);
  });

  it('returns a boolean', () => {
    const result = shouldEnableSample();
    expect(typeof result).toBe('boolean');
  });

  it('does not crash when localStorage throws', () => {
    const origGetItem = localStorage.getItem;
    const origSetItem = localStorage.setItem;

    localStorage.getItem = () => {
      throw new Error('denied');
    };
    localStorage.setItem = () => {
      throw new Error('denied');
    };

    _resetSamplingState();

    expect(() => shouldEnableSample()).not.toThrow();

    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
  });

  it('uses cached result on subsequent calls', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem');

    shouldEnableSample();
    shouldEnableSample();
    shouldEnableSample();

    // getItem should be called at most once (caching kicks in)
    expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
    spy.mockRestore();
  });

  it('produces deterministic result for a known client ID', () => {
    // Set a known client ID in localStorage
    localStorage.setItem('rum_user_id', 'test-deterministic-id-12345');
    _resetSamplingState();

    const result1 = shouldEnableSample();
    _resetSamplingState();

    // Re-read with same localStorage value
    const result2 = shouldEnableSample();
    expect(result1).toBe(result2);
  });
});
