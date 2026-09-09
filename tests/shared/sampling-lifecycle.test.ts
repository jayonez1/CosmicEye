import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modules = [
  { name: 'RDR', load: () => import('../../src/rdr/index') },
  { name: 'RT', load: () => import('../../src/rt/index') },
];

describe.each(modules)('$name sampling lifecycle', ({ load }) => {
  let tracker: Awaited<ReturnType<typeof load>>['default'];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    tracker = (await load()).default;
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enables collection by default, without accessing storage', () => {
    const local = vi.spyOn(window, 'localStorage', 'get');
    const session = vi.spyOn(window, 'sessionStorage', 'get');
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    expect(tracker.init()).toBe(true);
    expect(tracker.isInitialized()).toBe(true);
    expect(local).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
  });

  it.each([true, false])('retains random decision %s across init and destroy', (decision) => {
    const random = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(decision ? 0.1 : 0.9)
      .mockReturnValue(decision ? 0.9 : 0.1);
    const replacement = vi.fn(() => !decision);

    expect(tracker.init({ samplingRate: 0.15 })).toBe(decision);
    expect(tracker.init({ samplingRate: 0.15 })).toBe(decision);
    tracker.destroy();
    expect(tracker.isInitialized()).toBe(false);
    expect(tracker.init({ samplingRate: decision ? 0 : 1, samplingFn: replacement })).toBe(
      decision,
    );
    expect(tracker.isInitialized()).toBe(decision);
    expect(random).toHaveBeenCalledTimes(1);
    expect(replacement).not.toHaveBeenCalled();
  });

  it.each([true, false])('retains custom decision %s across init and destroy', (decision) => {
    const samplingFn = vi.fn().mockReturnValueOnce(decision).mockReturnValue(!decision);
    const random = vi.spyOn(Math, 'random');

    expect(tracker.init({ samplingRate: 0.15, samplingFn })).toBe(decision);
    expect(tracker.init({ samplingRate: 0.9, samplingFn })).toBe(decision);
    tracker.destroy();
    expect(tracker.init()).toBe(decision);
    expect(samplingFn).toHaveBeenCalledTimes(1);
    expect(samplingFn).toHaveBeenCalledWith(0.15);
    expect(random).not.toHaveBeenCalled();
  });

  it('passes the default rate of 1 to a custom function that rejects collection', () => {
    const samplingFn = vi.fn(() => false);

    expect(tracker.init({ samplingFn })).toBe(false);
    expect(samplingFn).toHaveBeenCalledTimes(1);
    expect(samplingFn).toHaveBeenCalledWith(1);
  });

  it('allows a custom function to enable collection at rate 0', () => {
    const samplingFn = vi.fn(() => true);

    expect(tracker.init({ samplingRate: 0, samplingFn })).toBe(true);
    expect(samplingFn).toHaveBeenCalledTimes(1);
    expect(samplingFn).toHaveBeenCalledWith(0);
  });

  it('retains rejection after a custom function throws', () => {
    const samplingFn = vi.fn(() => {
      throw new Error('sampling failed');
    });
    const random = vi.spyOn(Math, 'random');
    const addListener = vi.spyOn(window, 'addEventListener');

    expect(tracker.init({ samplingFn })).toBe(false);
    expect(tracker.init()).toBe(false);
    tracker.destroy();
    expect(tracker.init({ samplingRate: 1 })).toBe(false);
    expect(tracker.isInitialized()).toBe(false);
    expect(samplingFn).toHaveBeenCalledTimes(1);
    expect(random).not.toHaveBeenCalled();
    expect(addListener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('makes a fresh random decision when a page reload creates a new module instance', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);

    expect(tracker.init({ samplingRate: 0.15 })).toBe(false);
    tracker.destroy();
    vi.resetModules();
    tracker = (await load()).default;

    expect(tracker.init({ samplingRate: 0.15 })).toBe(true);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('calls the custom function again in a fresh module instance', async () => {
    const samplingFn = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);

    expect(tracker.init({ samplingRate: 0.15, samplingFn })).toBe(false);
    tracker.destroy();
    vi.resetModules();
    tracker = (await load()).default;

    expect(tracker.init({ samplingRate: 0.15, samplingFn })).toBe(true);
    expect(samplingFn.mock.calls).toEqual([[0.15], [0.15]]);
  });
});

it('keeps the RDR and RT sampling decisions independent', async () => {
  vi.resetModules();
  const { default: rdr } = await import('../../src/rdr/index');
  const { default: rt } = await import('../../src/rt/index');
  const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);

  try {
    expect(rdr.init({ samplingRate: 0.15 })).toBe(false);
    expect(rt.init({ samplingRate: 0.15 })).toBe(true);
    expect(random).toHaveBeenCalledTimes(2);
  } finally {
    rdr.destroy();
    rt.destroy();
    vi.restoreAllMocks();
  }
});
