import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

let rdr: typeof import('../../src/rdr/index').default;
let initRDR: typeof import('../../src/rdr/index').initRDR;
let consoleSpy: MockInstance;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  localStorage.setItem('rum_user_id', 'test-id-29');
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
  localStorage.removeItem('rum_user_id');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Lifecycle flush', () => {
  it('flushes on visibilitychange when hidden', () => {
    initRDR();
    consoleSpy.mockClear();

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(50);
    rdr.reqHandlerRpc(payload);

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

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  it('flushes on pagehide', () => {
    initRDR();
    consoleSpy.mockClear();

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(50);
    rdr.reqHandlerRpc(payload);

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

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(50);
    rdr.reqHandlerRpc(payload);

    rdr.destroy();

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('destroy'),
    );
    expect(call).toBeDefined();
  });
});
