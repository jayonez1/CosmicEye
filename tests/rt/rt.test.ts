import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { CRITICAL_TIMEOUT_MS } from '../../src/rt/config';

let rt: typeof import('../../src/rt/index').default;
let initRT: typeof import('../../src/rt/index').initRT;
let consoleSpy: MockInstance;

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

describe('RT.init', () => {
  it('initializes in dev mode', () => {
    initRT();
    expect(() => rt.startTransition('/home')).not.toThrow();
  });

  it('is idempotent', () => {
    initRT();
    initRT();
    expect(() => rt.startTransition('/home')).not.toThrow();
  });
});

describe('RT.startTransition', () => {
  it('is no-op when not initialized', () => {
    expect(() => rt.startTransition('/home')).not.toThrow();
  });

  it('aborts previous transition on new navigation', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/page-a');
    rt.startTransition('/page-b');

    // Mark and complete page-b
    rt.markRendered('/page-b');

    // Advance through 2×rAF + idle
    vi.advanceTimersByTime(100);

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    );
    // page-b should complete, page-a should be aborted (not sent)
    if (call) {
      const payload = call[1] as Record<string, unknown>;
      expect(payload.pathname).toBe('/page-b');
    }
  });
});

describe('RT.markRendered', () => {
  it('is no-op when not initialized', () => {
    expect(() => rt.markRendered('/home')).not.toThrow();
  });

  it('is no-op when pathname does not match current transition', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/page-a');
    rt.markRendered('/page-b'); // wrong pathname

    // Force completion via timeout
    vi.advanceTimersByTime(CRITICAL_TIMEOUT_MS + 100);

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    );
    if (call) {
      const payload = call[1] as Record<string, unknown>;
      // renderedAt should be null because markRendered didn't match
      expect(payload.routeRenderMs).toBeNull();
    }
  });
});

describe('RT complete flow', () => {
  it('sends log entry after render + frames + idle', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/users/123', '?tab=settings');
    rt.markRendered('/users/123');

    // Advance through 2×rAF (each ~16ms) + idle callback
    vi.advanceTimersByTime(200);

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    );
    expect(call).toBeDefined();

    const payload = call![1] as Record<string, unknown>;
    expect(payload.routeName).toBe('/users/:id');
    expect(payload.pathname).toBe('/users/123');
    expect(payload.search).toBe('?tab=settings');
    expect(typeof payload.routeRenderMs).toBe('number');
    expect(typeof payload.routeTtiMs).toBe('number');
    expect((payload.routeTtiMs as number)).toBeGreaterThanOrEqual(payload.routeRenderMs as number);
  });
});

describe('RT.trackCritical', () => {
  it('returns noop function when not initialized', () => {
    const done = rt.trackCritical();
    expect(typeof done).toBe('function');
    expect(() => done!()).not.toThrow();
  });

  it('delays TTI until critical operation completes (manual done)', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/home');

    const done = rt.trackCritical()!;
    expect(typeof done).toBe('function');

    rt.markRendered('/home');

    // Advance — should NOT send yet (pending critical)
    vi.advanceTimersByTime(200);
    expect(consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    )).toBeUndefined();

    // Complete the critical operation
    done();

    // Now advance to allow frames + idle
    vi.advanceTimersByTime(200);

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    );
    expect(call).toBeDefined();
  });

  it('auto-resolves when given a promise', async () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/home');

    let resolvePromise: () => void;
    const promise = new Promise<void>((r) => { resolvePromise = r; });

    const result = rt.trackCritical(promise);
    expect(result).toBeUndefined(); // returns undefined when given promise

    rt.markRendered('/home');

    // Advance — should NOT send yet
    vi.advanceTimersByTime(200);
    expect(consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    )).toBeUndefined();

    // Resolve the promise
    resolvePromise!();
    await promise;

    // Advance for frames + idle
    vi.advanceTimersByTime(200);

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    );
    expect(call).toBeDefined();
  });
});

describe('RT timeout', () => {
  it('sends timedOut entry when critical timeout expires', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/slow-page');
    // Don't call markRendered

    vi.advanceTimersByTime(CRITICAL_TIMEOUT_MS + 100);

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    );
    expect(call).toBeDefined();

    const payload = call![1] as Record<string, unknown>;
    expect(payload.timedOut).toBe(true);
    expect(payload.routeRenderMs).toBeNull();
    expect(typeof payload.routeTtiMs).toBe('number');
  });
});

describe('RT.destroy', () => {
  it('clears state and prevents further events', () => {
    initRT();
    consoleSpy.mockClear();

    rt.startTransition('/home');
    rt.destroy();

    rt.markRendered('/home');
    vi.advanceTimersByTime(CRITICAL_TIMEOUT_MS + 100);

    // No events should be sent after destroy
    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RT]'),
    );
    expect(call).toBeUndefined();
  });
});
