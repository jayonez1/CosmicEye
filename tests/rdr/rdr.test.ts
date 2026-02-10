import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { TIMINGS, FLUSH } from '../../src/rdr/config';

// We need to test the RDR class in isolation, so we import fresh modules
// and mock sampling to control initialization.

let rdr: typeof import('../../src/rdr/index').default;
let initRDR: typeof import('../../src/rdr/index').initRDR;
let consoleSpy: MockInstance;

// Mock sampling — default: enabled
vi.mock('../../src/rdr/sampling', () => ({
  shouldEnableSample: vi.fn(() => true),
  _resetSamplingState: vi.fn(),
}));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  // Reset modules to get a fresh RDR instance each test
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

describe('RDR.init', () => {
  it('initializes when sampling is enabled', () => {
    initRDR();
    // Should not throw, reqHandler should work after init
    expect(() => rdr.reqHandler({ s: 'Svc', m: 'get' })).not.toThrow();
  });

  it('does not activate when sampling is disabled', async () => {
    // Override the mock to return false for this test
    const sampling = await import('../../src/rdr/sampling');
    vi.mocked(sampling.shouldEnableSample).mockReturnValue(false);

    // Need a fresh RDR instance that will see the false return
    vi.resetModules();

    // Re-register the mock with false before importing
    vi.doMock('../../src/rdr/sampling', () => ({
      shouldEnableSample: vi.fn(() => false),
      _resetSamplingState: vi.fn(),
    }));

    const mod = await import('../../src/rdr/index');
    const localRdr = mod.default;
    mod.initRDR();

    consoleSpy.mockClear();
    localRdr.reqHandler({ s: 'Svc', m: 'get' });
    localRdr.reqHandler({ s: 'Svc', m: 'get' });

    // No flush should happen since not initialized
    vi.advanceTimersByTime(FLUSH.INTERVAL_MS + 100);
    expect(consoleSpy).not.toHaveBeenCalled();

    // Restore original mock for subsequent tests
    vi.doUnmock('../../src/rdr/sampling');
  });

  it('is idempotent — second init is no-op', () => {
    const spy = vi.spyOn(window, 'addEventListener');
    initRDR();
    const count1 = spy.mock.calls.length;
    initRDR();
    const count2 = spy.mock.calls.length;
    expect(count2).toBe(count1);
    spy.mockRestore();
  });
});

describe('RDR.reqHandler', () => {
  it('is no-op when not initialized', () => {
    // Don't call initRDR
    expect(() => rdr.reqHandler({ s: 'Svc', m: 'get' })).not.toThrow();
  });

  it('is no-op when payload has no s or m', () => {
    initRDR();
    expect(() => rdr.reqHandler({} as { s?: string; m?: string })).not.toThrow();
    expect(() => rdr.reqHandler({ s: 'Svc' } as { s?: string; m?: string })).not.toThrow();
    expect(() => rdr.reqHandler({ m: 'get' } as { s?: string; m?: string })).not.toThrow();
  });

  it('detects duplicate request within threshold', () => {
    initRDR();
    consoleSpy.mockClear();

    const payload = { s: 'Svc', m: 'get', p: { id: 1 }, b: {} };

    rdr.reqHandler(payload);
    // Small time advance — still within threshold
    vi.advanceTimersByTime(100);
    rdr.reqHandler(payload);

    // Force flush via destroy
    rdr.destroy();

    expect(consoleSpy).toHaveBeenCalled();
    const flushCall = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RDR] Flush'),
    );
    expect(flushCall).toBeDefined();
    const logs = flushCall![1] as Array<Record<string, unknown>>;
    expect(logs.length).toBe(1);
    expect(logs[0].endpoint).toBe('Svc.get');
  });

  it('does NOT detect duplicate after threshold expires', () => {
    initRDR();
    consoleSpy.mockClear();

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };

    rdr.reqHandler(payload);
    // Advance past threshold
    vi.advanceTimersByTime(TIMINGS.DUPLICATE_THRESHOLD_MS + 100);
    rdr.reqHandler(payload);

    // Force flush via destroy
    rdr.destroy();

    // Flush call should either not exist or have 0 log entries
    const flushCalls = consoleSpy.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RDR] Flush'),
    );
    for (const call of flushCalls) {
      const logs = call[1] as Array<Record<string, unknown>>;
      expect(logs.length).toBe(0);
    }
  });

  it('does NOT treat different requests as duplicates', () => {
    initRDR();
    consoleSpy.mockClear();

    rdr.reqHandler({ s: 'Svc', m: 'get', p: { id: 1 }, b: {} });
    rdr.reqHandler({ s: 'Svc', m: 'get', p: { id: 2 }, b: {} });

    // Force flush via destroy
    rdr.destroy();

    // Flush call should either not exist or have 0 log entries
    const flushCalls = consoleSpy.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RDR] Flush'),
    );
    for (const call of flushCalls) {
      const logs = call[1] as Array<Record<string, unknown>>;
      expect(logs.length).toBe(0);
    }
  });
});

describe('Flush threshold', () => {
  it('flushes immediately when MAX_EVENTS is reached', () => {
    initRDR();
    consoleSpy.mockClear();

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };

    // First call sets the baseline
    rdr.reqHandler(payload);

    // Generate MAX_EVENTS duplicates
    for (let i = 0; i < FLUSH.MAX_EVENTS; i++) {
      vi.advanceTimersByTime(10);
      rdr.reqHandler(payload);
    }

    // Flush should have been triggered by threshold
    const thresholdCall = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('threshold'),
    );
    expect(thresholdCall).toBeDefined();
  });
});

describe('Cleanup', () => {
  it('removes old entries from requestsMap after cleanup interval', () => {
    initRDR();

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandler(payload);

    // Advance past the cleanup interval + threshold so entries are stale
    vi.advanceTimersByTime(TIMINGS.CLEANUP_INTERVAL_MS + TIMINGS.DUPLICATE_THRESHOLD_MS + 100);

    // Now send the same request — it should NOT be a duplicate because old entry was cleaned
    consoleSpy.mockClear();

    rdr.reqHandler(payload);

    // Force flush via destroy
    rdr.destroy();

    // Flush call should either not exist or have 0 log entries
    const flushCalls = consoleSpy.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('[RDR] Flush'),
    );
    for (const call of flushCalls) {
      const logs = call[1] as Array<Record<string, unknown>>;
      expect(logs.length).toBe(0);
    }
  });
});
