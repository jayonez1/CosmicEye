import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let rt: typeof import('../../src/rt/index').default;
const send = vi.fn();

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame'],
  });
  vi.resetModules();
  send.mockReset();
  rt = (await import('../../src/rt/index')).default;
  rt.init({ send, includePathname: true, includeSearch: true, criticalTimeoutMs: 1000 });
});

afterEach(() => {
  rt.destroy();
  vi.useRealTimers();
});

describe('RT pathname transitions', () => {
  it('keeps the initial measurement when query changes before render', () => {
    expect(rt.startTransition('/items', '?page=1').started).toBe(true);
    vi.advanceTimersByTime(50);
    expect(rt.startTransition('/items', '?page=2').started).toBe(false);
    rt.markRendered('/items');
    vi.advanceTimersByTime(1100);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].entry).toMatchObject({
      pathname: '/items',
      search: '?page=1',
      routeRenderMs: 50,
    });
    expect(send.mock.calls[0][0].entry.timedOut).toBeUndefined();
  });

  it('does not create a timeout after query-only or identical navigation', () => {
    rt.startTransition('/items', '?page=1');
    rt.markRendered('/items');
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(1);

    expect(rt.startTransition('/items', '?page=2').started).toBe(false);
    expect(rt.startTransition('/items', '?page=2').started).toBe(false);
    vi.advanceTimersByTime(1100);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('preserves pending critical work across query-only navigation', () => {
    rt.startTransition('/items', '?page=1');
    const { done } = rt.trackCritical();
    rt.markRendered('/items');
    rt.startTransition('/items', '?page=2');
    vi.advanceTimersByTime(100);
    expect(send).not.toHaveBeenCalled();

    done!();
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].entry.timedOut).toBeUndefined();
  });

  it('measures pathname changes and a return to a previously visited path', () => {
    for (const path of ['/items', '/settings', '/items']) {
      expect(rt.startTransition(path).started).toBe(true);
      rt.markRendered(path);
      vi.advanceTimersByTime(100);
    }
    expect(send.mock.calls.map(([payload]) => payload.entry.pathname)).toEqual([
      '/items',
      '/settings',
      '/items',
    ]);
  });

  it('allows an explicit restart after abort or destroy', () => {
    rt.startTransition('/items');
    rt.abortPending();
    expect(rt.startTransition('/items').started).toBe(true);
    rt.destroy();
    rt.init();
    expect(rt.startTransition('/items').started).toBe(true);
  });

  it('does not restart a timed-out transition on a query change', () => {
    rt.startTransition('/items', '?page=1');
    vi.advanceTimersByTime(1100);
    expect(send.mock.calls[0][0].entry.timedOut).toBe(true);
    expect(rt.startTransition('/items', '?page=2').started).toBe(false);
    vi.advanceTimersByTime(1100);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('RT rejected critical promise', () => {
  it('preserves the application rejection and completes tracking without an unhandled rejection', async () => {
    rt.startTransition('/items');
    const failure = new Error('request failed');
    const request = Promise.reject(failure);
    rt.trackCritical(request);
    rt.markRendered('/items');

    await expect(request).rejects.toBe(failure);
    // Advancing asynchronously also lets Node report any unhandled rejection
    // from the library branch; Vitest fails the run if one occurs.
    await vi.advanceTimersByTimeAsync(1100);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].entry.timedOut).toBeUndefined();
  });
});
