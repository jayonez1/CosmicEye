import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

vi.mock('../../src/rdr/sampling', () => ({
  shouldEnableSample: vi.fn(() => true),
  _resetSamplingState: vi.fn(),
}));

let rdr: typeof import('../../src/rdr/index').default;
let initRDR: typeof import('../../src/rdr/index').initRDR;
let consoleSpy: MockInstance;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.resetModules();

  const mod = await import('../../src/rdr/index');
  rdr = mod.default;
  initRDR = mod.initRDR;
});

afterEach(() => {
  try {
    rdr.destroy();
  } catch (_) {
    // ignore
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Lifecycle flush', () => {
  it('flushes on visibilitychange when hidden', () => {
    initRDR();
    consoleSpy.mockClear();

    // Create a duplicate
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandler(payload);
    vi.advanceTimersByTime(50);
    rdr.reqHandler(payload);

    // Simulate visibilitychange to hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('visibilitychange'),
    );
    expect(call).toBeDefined();

    // Restore
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  it('flushes on pagehide', () => {
    initRDR();
    consoleSpy.mockClear();

    // Create a duplicate
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandler(payload);
    vi.advanceTimersByTime(50);
    rdr.reqHandler(payload);

    // Simulate pagehide
    window.dispatchEvent(new Event('pagehide'));

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('pagehide'),
    );
    expect(call).toBeDefined();
  });

  it('flushes on destroy', () => {
    initRDR();
    consoleSpy.mockClear();

    // Create a duplicate
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandler(payload);
    vi.advanceTimersByTime(50);
    rdr.reqHandler(payload);

    rdr.destroy();

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('destroy'),
    );
    expect(call).toBeDefined();
  });
});
