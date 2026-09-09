import { describe, it, expect, vi, afterEach } from 'vitest';
import { shouldEnableSample } from '../../src/shared/sampling';
import type { SamplingFn } from '../../src/shared/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shouldEnableSample', () => {
  it.each([
    { rate: 1, random: 0.999, expected: true },
    { rate: 0, random: 0, expected: false },
    { rate: 0.15, random: 0.149, expected: true },
    { rate: 0.15, random: 0.15, expected: false },
    { rate: 0.15, random: 0.9, expected: false },
  ])('samples rate $rate with random $random as $expected', ({ rate, random, expected }) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    expect(shouldEnableSample({ rate })).toBe(expected);
  });

  it.each([0, 0.15, 1])('lets the custom function accept or reject at rate %s', (rate) => {
    const random = vi.spyOn(Math, 'random');
    const samplingFn = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);

    expect(shouldEnableSample({ rate, samplingFn })).toBe(false);
    expect(shouldEnableSample({ rate, samplingFn })).toBe(true);
    expect(samplingFn.mock.calls).toEqual([[rate], [rate]]);
    expect(random).not.toHaveBeenCalled();
  });

  it('returns false when the custom function throws, without falling back to random', () => {
    const random = vi.spyOn(Math, 'random');
    const samplingFn = () => {
      throw new Error('sampling failed');
    };

    expect(shouldEnableSample({ rate: 1, samplingFn })).toBe(false);
    expect(random).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 1, 'true', {}, Promise.resolve(true)])(
    'rejects a non-boolean custom result: %s',
    (result) => {
      const samplingFn = (() => result) as unknown as SamplingFn;
      expect(shouldEnableSample({ rate: 1, samplingFn })).toBe(false);
    },
  );

  it.each([-0.1, 1.1, NaN, Infinity, -Infinity])('rejects an invalid rate: %s', (rate) => {
    const random = vi.spyOn(Math, 'random');
    const samplingFn = vi.fn(() => true);

    expect(shouldEnableSample({ rate })).toBe(false);
    expect(shouldEnableSample({ rate, samplingFn })).toBe(false);
    expect(samplingFn).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('works without reading localStorage or sessionStorage', () => {
    const denyStorage = () => {
      throw new Error('storage denied');
    };
    const local = vi.spyOn(window, 'localStorage', 'get').mockImplementation(denyStorage);
    const session = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(denyStorage);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    expect(shouldEnableSample({ rate: 0.15 })).toBe(true);
    expect(local).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
  });
});
