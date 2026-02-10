import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { observeHistory } from '../../../src/extensions/history-route-observer';
import type { HistoryLike } from '../../../src/extensions/history-route-observer';

/**
 * Integration-style test: verifies that RDR pre-render reset can be
 * triggered via the observer on navigation, without RouteTracker.
 *
 * We simulate the pattern:
 *   observer.subscribe(({ pathname }) => {
 *     rdr.resetTiming();
 *     rdr.resetActions();
 *   });
 */

function createMockHistory(): HistoryLike {
  return {
    location: { pathname: '/home', search: '' },
    push: vi.fn(),
    replace: vi.fn(),
    listen: vi.fn(() => () => {}),
  };
}

describe('RDR pre-render reset via observer', () => {
  let history: HistoryLike;
  let resetTiming: ReturnType<typeof vi.fn>;
  let resetActions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    history = createMockHistory();
    resetTiming = vi.fn();
    resetActions = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls RDR reset on INIT (page load)', () => {
    const observer = observeHistory(history);

    observer.subscribe(() => {
      resetTiming();
      resetActions();
    });

    // INIT fires on first subscribe
    expect(resetTiming).toHaveBeenCalledTimes(1);
    expect(resetActions).toHaveBeenCalledTimes(1);

    observer.unpatch();
  });

  it('calls RDR reset on PUSH navigation (pre-render)', () => {
    const observer = observeHistory(history);

    observer.subscribe(() => {
      resetTiming();
      resetActions();
    });

    resetTiming.mockClear();
    resetActions.mockClear();

    history.push('/users/42');

    expect(resetTiming).toHaveBeenCalledTimes(1);
    expect(resetActions).toHaveBeenCalledTimes(1);

    observer.unpatch();
  });

  it('calls RDR reset on REPLACE navigation (pre-render)', () => {
    const observer = observeHistory(history);

    observer.subscribe(() => {
      resetTiming();
      resetActions();
    });

    resetTiming.mockClear();
    resetActions.mockClear();

    history.replace('/login');

    expect(resetTiming).toHaveBeenCalledTimes(1);
    expect(resetActions).toHaveBeenCalledTimes(1);

    observer.unpatch();
  });

  it('pre-render reset fires BEFORE post-render RouteTracker would', () => {
    const callOrder: string[] = [];

    const observer = observeHistory(history);

    // This simulates the recommended pattern:
    // 1. observer.subscribe → pre-render reset
    // 2. RouteTracker onRouteChange → post-render markRendered
    observer.subscribe(() => {
      callOrder.push('pre-render:reset');
    });

    // Simulate RouteTracker callback (would fire later, after React commit)
    const postRenderCallback = () => {
      callOrder.push('post-render:markRendered');
    };

    // Clear INIT
    callOrder.length = 0;

    // PUSH fires pre-render immediately
    history.push('/dashboard');
    expect(callOrder).toEqual(['pre-render:reset']);

    // RouteTracker fires after React commit (simulated)
    postRenderCallback();
    expect(callOrder).toEqual(['pre-render:reset', 'post-render:markRendered']);

    observer.unpatch();
  });

  it('does NOT fire after unpatch', () => {
    const observer = observeHistory(history);

    observer.subscribe(() => {
      resetTiming();
      resetActions();
    });

    resetTiming.mockClear();
    resetActions.mockClear();

    observer.unpatch();

    history.push('/ignored');

    expect(resetTiming).not.toHaveBeenCalled();
    expect(resetActions).not.toHaveBeenCalled();
  });
});
