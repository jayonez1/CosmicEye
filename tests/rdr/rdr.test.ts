import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { DEFAULTS } from '../../src/rdr/config';

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

// ─── init ───

describe('RDR.init', () => {
  it('returns true when initialized successfully', () => {
    const result = initRDR();
    expect(result).toBe(true);
    expect(rdr.isInitialized()).toBe(true);
  });

  it('returns false when sampling rate is 0', async () => {
    vi.resetModules();
    const mod = await import('../../src/rdr/index');
    const result = mod.initRDR({ samplingRate: 0 });
    expect(result).toBe(false);
    expect(mod.default.isInitialized()).toBe(false);
  });

  it('returns true on repeated call (already initialized)', () => {
    initRDR();
    const second = rdr.init();
    expect(second).toBe(true);
  });

  it('is idempotent — second init does not re-attach listeners', () => {
    const spy = vi.spyOn(window, 'addEventListener');
    initRDR();
    const count1 = spy.mock.calls.length;
    initRDR();
    const count2 = spy.mock.calls.length;
    expect(count2).toBe(count1);
    spy.mockRestore();
  });
});

// ─── isInitialized ───

describe('RDR.isInitialized', () => {
  it('returns false before init', () => {
    expect(rdr.isInitialized()).toBe(false);
  });

  it('returns true after successful init', () => {
    initRDR();
    expect(rdr.isInitialized()).toBe(true);
  });

  it('returns false after destroy', () => {
    initRDR();
    rdr.destroy();
    expect(rdr.isInitialized()).toBe(false);
  });
});

// ─── reqHandlerRpc ───

describe('RDR.reqHandlerRpc', () => {
  it('returns initialized:false when not initialized', () => {
    const result = rdr.reqHandlerRpc({ s: 'Svc', m: 'get' });
    expect(result).toEqual({ initialized: false, processed: false, duplicate: false });
  });

  it('returns processed:false when payload has no s or m', () => {
    initRDR();
    expect(rdr.reqHandlerRpc({}).processed).toBe(false);
    expect(rdr.reqHandlerRpc({ s: 'Svc' }).processed).toBe(false);
    expect(rdr.reqHandlerRpc({ m: 'get' }).processed).toBe(false);
  });

  it('detects duplicate request within threshold', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: { id: 1 }, b: {} };

    const r1 = rdr.reqHandlerRpc(payload);
    expect(r1).toEqual({ initialized: true, processed: true, duplicate: false });

    vi.advanceTimersByTime(100);
    const r2 = rdr.reqHandlerRpc(payload);
    expect(r2).toEqual({ initialized: true, processed: true, duplicate: true });
  });

  it('does NOT detect duplicate after threshold expires', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };

    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(DEFAULTS.DUPLICATE_THRESHOLD_MS + 100);
    const r2 = rdr.reqHandlerRpc(payload);
    expect(r2.duplicate).toBe(false);
  });

  it('does NOT treat different requests as duplicates', () => {
    initRDR();
    rdr.reqHandlerRpc({ s: 'Svc', m: 'get', p: { id: 1 }, b: {} });
    const r2 = rdr.reqHandlerRpc({ s: 'Svc', m: 'get', p: { id: 2 }, b: {} });
    expect(r2.duplicate).toBe(false);
  });
});

// ─── reqHandlerHttp ───

describe('RDR.reqHandlerHttp', () => {
  it('returns initialized:false when not initialized', () => {
    const result = rdr.reqHandlerHttp({ httpMethod: 'GET', endpoint: '/api/test' });
    expect(result.initialized).toBe(false);
  });

  it('detects duplicate HTTP request', () => {
    initRDR();
    const payload = { httpMethod: 'GET', endpoint: '/api/users', bodyText: '' };

    rdr.reqHandlerHttp(payload);
    vi.advanceTimersByTime(100);
    const r2 = rdr.reqHandlerHttp(payload);
    expect(r2.duplicate).toBe(true);
  });

  it('includes httpMethod in fingerprint — GET vs POST are different', () => {
    initRDR();
    rdr.reqHandlerHttp({ httpMethod: 'GET', endpoint: '/api/users', bodyText: '' });
    vi.advanceTimersByTime(100);
    const r2 = rdr.reqHandlerHttp({ httpMethod: 'POST', endpoint: '/api/users', bodyText: '' });
    expect(r2.duplicate).toBe(false);
  });

  it('returns processed:false when httpMethod or endpoint is missing', () => {
    initRDR();
    expect(rdr.reqHandlerHttp({ httpMethod: '', endpoint: '/api' }).processed).toBe(false);
    expect(rdr.reqHandlerHttp({ httpMethod: 'GET', endpoint: '' }).processed).toBe(false);
  });
});

// ─── reqHandler (deprecated alias) ───

describe('RDR.reqHandler (deprecated alias)', () => {
  it('delegates to reqHandlerRpc', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    const result = rdr.reqHandler(payload);
    expect(result.initialized).toBe(true);
    expect(result.processed).toBe(true);
  });
});

// ─── flush ───

describe('RDR.flush', () => {
  it('returns initialized:false when not initialized', () => {
    const result = rdr.flush();
    expect(result).toEqual({ initialized: false, flushed: false, entriesCount: 0 });
  });

  it('returns flushed:false when queue is empty', () => {
    initRDR();
    const result = rdr.flush('manual');
    expect(result).toEqual({ initialized: true, flushed: false, entriesCount: 0 });
  });

  it('flushes queue and returns correct entriesCount', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);

    consoleSpy.mockClear();
    const result = rdr.flush('manual', { page: '/home' });
    expect(result.flushed).toBe(true);
    expect(result.entriesCount).toBe(1);
  });

  it('trigger and meta appear in send payload (console fallback)', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);

    consoleSpy.mockClear();
    rdr.flush('my_trigger', { custom: true });

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('my_trigger'),
    );
    expect(call).toBeDefined();
    const flushPayload = call![1] as { trigger: string; meta?: unknown; entries: unknown[] };
    expect(flushPayload.trigger).toBe('my_trigger');
    expect(flushPayload.meta).toEqual({ custom: true });
    expect(flushPayload.entries.length).toBe(1);
  });

  it('flushes automatically when flushMaxEvents is reached', () => {
    initRDR({ flushMaxEvents: 2 });
    consoleSpy.mockClear();

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);

    // Two duplicates → reaches threshold of 2
    vi.advanceTimersByTime(10);
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(10);
    rdr.reqHandlerRpc(payload);

    const thresholdCall = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('threshold'),
    );
    expect(thresholdCall).toBeDefined();
  });
});

// ─── send function ───

describe('RDR send function', () => {
  it('calls custom send function instead of console.log', () => {
    const sendFn = vi.fn();
    initRDR({ send: sendFn });

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);

    consoleSpy.mockClear();
    rdr.flush('test');

    expect(sendFn).toHaveBeenCalledTimes(1);
    const arg = sendFn.mock.calls[0][0];
    expect(arg.trigger).toBe('test');
    expect(arg.entries.length).toBe(1);
    // console.log should NOT have been called for the flush
    const consoleFlush = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('CosmicEye: RDR'),
    );
    expect(consoleFlush).toBeUndefined();
  });

  it('falls back to console.log when send not provided', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);

    consoleSpy.mockClear();
    rdr.flush();

    const call = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('CosmicEye: RDR'),
    );
    expect(call).toBeDefined();
  });
});

// ─── tag ───

describe('RDR tag', () => {
  it('includes tag in log entry when configured', () => {
    const sendFn = vi.fn();
    initRDR({ send: sendFn, tag: 'my-app-v2' });

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);
    rdr.flush();

    const entry = sendFn.mock.calls[0][0].entries[0];
    expect(entry.tag).toBe('my-app-v2');
  });
});

// ─── enrichers ───

describe('RDR enrichers', () => {
  it('includes enricher output in log entry', () => {
    const sendFn = vi.fn();
    initRDR({
      send: sendFn,
      enrichers: [{ name: 'userId', get: () => 'user-123' }],
    });

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);
    rdr.flush();

    const entry = sendFn.mock.calls[0][0].entries[0];
    expect(entry.enrichments).toBeDefined();
    expect(entry.enrichments.userId).toBe('user-123');
  });

  it('does not crash when enricher throws', () => {
    const sendFn = vi.fn();
    initRDR({
      send: sendFn,
      enrichers: [
        { name: 'broken', get: () => { throw new Error('boom'); } },
        { name: 'ok', get: () => 42 },
      ],
    });

    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);
    rdr.flush();

    const entry = sendFn.mock.calls[0][0].entries[0];
    expect(entry.enrichments.broken).toEqual({ error: 'enricher_failed' });
    expect(entry.enrichments.ok).toBe(42);
  });
});

// ─── chromeExtensionEvents ───

describe('RDR chromeExtensionEvents', () => {
  it('dispatches custom events when enabled', () => {
    const eventSpy = vi.fn();
    window.addEventListener('rdr', eventSpy);

    initRDR({ chromeExtensionEvents: true });
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);

    // 'log' event should have been dispatched
    expect(eventSpy).toHaveBeenCalled();
    const detail = (eventSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.type).toBe('log');

    window.removeEventListener('rdr', eventSpy);
  });

  it('does NOT dispatch when disabled (default)', () => {
    const eventSpy = vi.fn();
    window.addEventListener('rdr', eventSpy);

    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);

    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener('rdr', eventSpy);
  });
});

// ─── resetTiming / resetActions ───

describe('RDR.resetTiming / resetActions', () => {
  it('resetTiming returns initialized:false when not initialized', () => {
    expect(rdr.resetTiming()).toEqual({ initialized: false, reset: false });
  });

  it('resetTiming returns reset:true when initialized', () => {
    initRDR();
    expect(rdr.resetTiming()).toEqual({ initialized: true, reset: true });
  });

  it('resetActions returns initialized:false when not initialized', () => {
    expect(rdr.resetActions()).toEqual({ initialized: false, reset: false });
  });

  it('resetActions returns reset:true when initialized', () => {
    initRDR();
    expect(rdr.resetActions()).toEqual({ initialized: true, reset: true });
  });
});

// ─── destroy ───

describe('RDR.destroy', () => {
  it('returns destroyed:false when not initialized', () => {
    expect(rdr.destroy()).toEqual({ initialized: false, destroyed: false });
  });

  it('returns destroyed:true and flushes remaining entries', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);
    vi.advanceTimersByTime(100);
    rdr.reqHandlerRpc(payload);

    consoleSpy.mockClear();
    const result = rdr.destroy();
    expect(result).toEqual({ initialized: false, destroyed: true });
    expect(rdr.isInitialized()).toBe(false);

    // Should have flushed
    expect(consoleSpy).toHaveBeenCalled();
  });
});

// ─── Cleanup ───

describe('Cleanup', () => {
  it('removes old entries from requestsMap after cleanup interval', () => {
    initRDR();
    const payload = { s: 'Svc', m: 'get', p: {}, b: {} };
    rdr.reqHandlerRpc(payload);

    vi.advanceTimersByTime(DEFAULTS.CLEANUP_INTERVAL_MS + DEFAULTS.DUPLICATE_THRESHOLD_MS + 100);

    const result = rdr.reqHandlerRpc(payload);
    expect(result.duplicate).toBe(false);
  });
});
