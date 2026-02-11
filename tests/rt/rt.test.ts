import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { DEFAULTS } from '../../src/rt/config';

let rt: typeof import('../../src/rt/index').default;
let initRT: typeof import('../../src/rt/index').initRT;
let consoleSpy: MockInstance;

const findRtLog = (spy: MockInstance) =>
  spy.mock.calls.find(
    (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('CosmicEye: RT'),
  );

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
    ],
  });
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  vi.resetModules();

  const mod = await import('../../src/rt/index');
  rt = mod.default;
  initRT = mod.initRT;
});

afterEach(() => {
  try {
    rt.destroy();
  } catch (_) {
    // ignore
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── init ───

describe('RT.init', () => {
  it('returns true when initialized successfully', () => {
    const result = initRT();
    expect(result).toBe(true);
    expect(rt.isInitialized()).toBe(true);
  });

  it('returns false when sampling rate is 0', async () => {
    vi.resetModules();
    const mod = await import('../../src/rt/index');
    const result = mod.initRT({ samplingRate: 0 });
    expect(result).toBe(false);
    expect(mod.default.isInitialized()).toBe(false);
  });

  it('returns true on repeated call (already initialized)', () => {
    initRT();
    const second = rt.init();
    expect(second).toBe(true);
  });

  it('is idempotent', () => {
    initRT();
    initRT();
    expect(rt.isInitialized()).toBe(true);
  });
});

// ─── isInitialized ───

describe('RT.isInitialized', () => {
  it('returns false before init', () => {
    expect(rt.isInitialized()).toBe(false);
  });

  it('returns true after successful init', () => {
    initRT();
    expect(rt.isInitialized()).toBe(true);
  });

  it('returns false after destroy', () => {
    initRT();
    rt.destroy();
    expect(rt.isInitialized()).toBe(false);
  });
});

// ─── startTransition ───

describe('RT.startTransition', () => {
  it('returns initialized:false when not initialized', () => {
    const result = rt.startTransition('/home');
    expect(result).toEqual({ initialized: false, started: false });
  });

  it('returns started:true when initialized', () => {
    initRT();
    const result = rt.startTransition('/home');
    expect(result).toEqual({ initialized: true, started: true });
  });

  it('aborts previous transition on new navigation', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/page-a');
    rt.startTransition('/page-b');

    rt.markRendered('/page-b');
    vi.advanceTimersByTime(100);

    const call = findRtLog(consoleSpy);
    if (call) {
      const payload = call[1] as { entry: Record<string, unknown> };
      expect(payload.entry.routeName).toContain('page-b');
    }
  });
});

// ─── markRendered ───

describe('RT.markRendered', () => {
  it('returns initialized:false when not initialized', () => {
    const result = rt.markRendered('/home');
    expect(result).toEqual({ initialized: false, marked: false });
  });

  it('returns marked:false when pathname does not match', () => {
    initRT();
    rt.startTransition('/page-a');
    const result = rt.markRendered('/page-b');
    expect(result).toEqual({ initialized: true, marked: false });
  });

  it('returns marked:true on correct pathname', () => {
    initRT();
    rt.startTransition('/home');
    const result = rt.markRendered('/home');
    expect(result).toEqual({ initialized: true, marked: true });
  });

  it('is no-op when pathname does not match current transition', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/page-a');
    rt.markRendered('/page-b');

    vi.advanceTimersByTime(DEFAULTS.CRITICAL_TIMEOUT_MS + 100);

    const call = findRtLog(consoleSpy);
    if (call) {
      const payload = call[1] as { entry: Record<string, unknown> };
      expect(payload.entry.routeRenderMs).toBeNull();
    }
  });
});

// ─── complete flow ───

describe('RT complete flow', () => {
  it('sends log entry after render + frames + idle (includePathname/Search)', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn, includePathname: true, includeSearch: true });

    rt.startTransition('/users/123', '?tab=settings');
    rt.markRendered('/users/123');

    vi.advanceTimersByTime(200);

    expect(sendFn).toHaveBeenCalledTimes(1);
    const payload = sendFn.mock.calls[0][0];
    expect(payload.type).toBe('transition');
    const entry = payload.entry;
    expect(entry.routeName).toBe('/users/:id');
    expect(entry.pathname).toBe('/users/123');
    expect(entry.search).toBe('?tab=settings');
    expect(typeof entry.routeRenderMs).toBe('number');
    expect(typeof entry.routeTtiMs).toBe('number');
    expect(entry.routeTtiMs).toBeGreaterThanOrEqual(entry.routeRenderMs);
  });

  it('does NOT include pathname/search by default', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn });

    rt.startTransition('/users/123', '?tab=settings');
    rt.markRendered('/users/123');
    vi.advanceTimersByTime(200);

    const entry = sendFn.mock.calls[0][0].entry;
    expect(entry.pathname).toBeUndefined();
    expect(entry.search).toBeUndefined();
  });
});

// ─── trackCritical ───

describe('RT.trackCritical', () => {
  it('returns done function with tracked:false when not initialized', () => {
    const result = rt.trackCritical();
    expect(result.tracked).toBe(false);
    expect(typeof result.done).toBe('function');
    expect(() => result.done!()).not.toThrow();
  });

  it('delays TTI until critical operation completes (manual done)', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn });

    rt.startTransition('/home');

    const result = rt.trackCritical();
    expect(result.tracked).toBe(true);
    expect(typeof result.done).toBe('function');

    rt.markRendered('/home');

    vi.advanceTimersByTime(200);
    expect(sendFn).not.toHaveBeenCalled();

    result.done!();
    vi.advanceTimersByTime(200);

    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('auto-resolves when given a promise', async () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn });

    rt.startTransition('/home');

    let resolvePromise: () => void;
    const promise = new Promise<void>((r) => { resolvePromise = r; });

    const result = rt.trackCritical(promise);
    expect(result.tracked).toBe(true);
    expect(result.done).toBeUndefined();

    rt.markRendered('/home');

    vi.advanceTimersByTime(200);
    expect(sendFn).not.toHaveBeenCalled();

    resolvePromise!();
    await promise;

    vi.advanceTimersByTime(200);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });
});

// ─── abortPending ───

describe('RT.abortPending', () => {
  it('returns initialized:false when not initialized', () => {
    const result = rt.abortPending('test');
    expect(result).toEqual({ initialized: false, aborted: false });
  });

  it('returns aborted:false when no active transition', () => {
    initRT();
    const result = rt.abortPending('no-transition');
    expect(result).toEqual({ initialized: true, aborted: false });
  });

  it('aborts active transition and sends abort event', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn, includePathname: true });

    rt.startTransition('/slow-page');
    const result = rt.abortPending('user-cancelled');

    expect(result).toEqual({ initialized: true, aborted: true });
    expect(sendFn).toHaveBeenCalledTimes(1);

    const payload = sendFn.mock.calls[0][0];
    expect(payload.type).toBe('abort');
    expect(payload.entry.aborted).toBe(true);
    expect(payload.entry.abortReason).toBe('user-cancelled');
    expect(payload.entry.pathname).toBe('/slow-page');
  });

  it('prevents transition from completing after abort', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn });

    rt.startTransition('/home');
    rt.abortPending('abort-it');
    sendFn.mockClear();

    rt.markRendered('/home');
    vi.advanceTimersByTime(DEFAULTS.CRITICAL_TIMEOUT_MS + 100);

    // No further events after abort
    expect(sendFn).not.toHaveBeenCalled();
  });
});

// ─── timeout ───

describe('RT timeout', () => {
  it('sends timedOut entry when critical timeout expires', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn });

    rt.startTransition('/slow-page');

    vi.advanceTimersByTime(DEFAULTS.CRITICAL_TIMEOUT_MS + 100);

    expect(sendFn).toHaveBeenCalledTimes(1);
    const entry = sendFn.mock.calls[0][0].entry;
    expect(entry.timedOut).toBe(true);
    expect(entry.routeRenderMs).toBeNull();
    expect(typeof entry.routeTtiMs).toBe('number');
  });
});

// ─── destroy ───

describe('RT.destroy', () => {
  it('returns destroyed:false when not initialized', () => {
    expect(rt.destroy()).toEqual({ initialized: false, destroyed: false });
  });

  it('returns destroyed:true and clears state', () => {
    initRT();
    const result = rt.destroy();
    expect(result).toEqual({ initialized: false, destroyed: true });
    expect(rt.isInitialized()).toBe(false);
  });

  it('prevents further events', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn });

    rt.startTransition('/home');
    rt.destroy();
    sendFn.mockClear();

    vi.advanceTimersByTime(DEFAULTS.CRITICAL_TIMEOUT_MS + 100);
    expect(sendFn).not.toHaveBeenCalled();
  });
});

// ─── send function ───

describe('RT send function', () => {
  it('calls custom send function instead of console.log', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn });

    rt.startTransition('/home');
    rt.markRendered('/home');
    vi.advanceTimersByTime(200);

    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('CosmicEye: RT'),
    )).toBeUndefined();
  });

  it('falls back to console.log when send not provided', () => {
    initRT();

    rt.startTransition('/home');
    rt.markRendered('/home');
    vi.advanceTimersByTime(200);

    expect(findRtLog(consoleSpy)).toBeDefined();
  });
});

// ─── tag ───

describe('RT tag', () => {
  it('includes tag in log entry', () => {
    const sendFn = vi.fn();
    initRT({ send: sendFn, tag: 'my-app' });

    rt.startTransition('/home');
    rt.markRendered('/home');
    vi.advanceTimersByTime(200);

    expect(sendFn.mock.calls[0][0].entry.tag).toBe('my-app');
  });
});

// ─── enrichers ───

describe('RT enrichers', () => {
  it('includes enricher output in log entry', () => {
    const sendFn = vi.fn();
    initRT({
      send: sendFn,
      enrichers: [{ name: 'sessionId', get: () => 'sess-abc' }],
    });

    rt.startTransition('/home');
    rt.markRendered('/home');
    vi.advanceTimersByTime(200);

    const entry = sendFn.mock.calls[0][0].entry;
    expect(entry.enrichments).toBeDefined();
    expect(entry.enrichments.sessionId).toBe('sess-abc');
  });
});

// ─── chromeExtensionEvents ───

describe('RT chromeExtensionEvents', () => {
  it('dispatches custom events when enabled', () => {
    const eventSpy = vi.fn();
    window.addEventListener('rt', eventSpy);

    initRT({ chromeExtensionEvents: true });
    rt.startTransition('/home');
    rt.markRendered('/home');
    vi.advanceTimersByTime(200);

    expect(eventSpy).toHaveBeenCalled();
    const detail = (eventSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.type).toBe('transition');

    window.removeEventListener('rt', eventSpy);
  });

  it('does NOT dispatch when disabled (default)', () => {
    const eventSpy = vi.fn();
    window.addEventListener('rt', eventSpy);

    initRT();
    rt.startTransition('/home');
    rt.markRendered('/home');
    vi.advanceTimersByTime(200);

    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener('rt', eventSpy);
  });
});
