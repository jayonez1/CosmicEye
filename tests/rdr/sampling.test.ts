import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldEnableSample } from '../../src/shared/sampling';

const BASE_CONFIG = { rate: 0.05, storageKey: 'rum_user_id' };

beforeEach(() => {
  localStorage.clear();
});

describe('shouldEnableSample', () => {
  it('returns true when rate >= 1', () => {
    expect(shouldEnableSample({ ...BASE_CONFIG, rate: 1 })).toBe(true);
  });

  it('returns false when rate <= 0', () => {
    expect(shouldEnableSample({ ...BASE_CONFIG, rate: 0 })).toBe(false);
  });

  it('returns a boolean for fractional rate', () => {
    const result = shouldEnableSample(BASE_CONFIG);
    expect(typeof result).toBe('boolean');
  });

  it('does not crash when localStorage throws', () => {
    const origGetItem = localStorage.getItem;
    const origSetItem = localStorage.setItem;

    localStorage.getItem = () => { throw new Error('denied'); };
    localStorage.setItem = () => { throw new Error('denied'); };

    expect(() => shouldEnableSample(BASE_CONFIG)).not.toThrow();

    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
  });

  it('produces deterministic result for explicit clientId', () => {
    const config = { ...BASE_CONFIG, clientId: 'test-deterministic-id-12345' };
    const result1 = shouldEnableSample(config);
    const result2 = shouldEnableSample(config);
    expect(result1).toBe(result2);
  });

  it('uses explicit clientId over localStorage', () => {
    localStorage.setItem('rum_user_id', 'stored-id');
    const spy = vi.spyOn(Storage.prototype, 'getItem');

    shouldEnableSample({ ...BASE_CONFIG, clientId: 'explicit-id' });

    // localStorage.getItem should NOT have been called
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('different clientIds can produce different sampling decisions', () => {
    // With rate=0.5, different client IDs should eventually differ
    const results = new Set<boolean>();
    for (let i = 0; i < 100; i++) {
      results.add(shouldEnableSample({ ...BASE_CONFIG, rate: 0.5, clientId: `client-${i}` }));
    }
    expect(results.size).toBe(2); // both true and false
  });
});
