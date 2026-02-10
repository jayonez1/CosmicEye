import { describe, it, expect, vi, beforeEach } from 'vitest';
import { observeHistory } from '../../../src/extensions/history-route-observer';
import type { HistoryLike, NavigationEvent } from '../../../src/extensions/history-route-observer';

/** Creates a minimal mock history object (v5-style listen by default). */
function createMockHistory(opts?: { v4?: boolean }): HistoryLike & {
  _listeners: ((...args: unknown[]) => void)[];
  _simulatePop: (pathname: string, search?: string) => void;
} {
  const listeners: ((...args: unknown[]) => void)[] = [];

  const history: HistoryLike & {
    _listeners: typeof listeners;
    _simulatePop: (pathname: string, search?: string) => void;
  } = {
    location: { pathname: '/initial', search: '' },
    push: vi.fn(),
    replace: vi.fn(),
    listen: vi.fn((cb: (...args: unknown[]) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }),
    _listeners: listeners,
    _simulatePop(pathname: string, search = '') {
      const location = { pathname, search };
      for (const cb of listeners) {
        if (opts?.v4) {
          cb(location, 'POP');
        } else {
          cb({ location, action: 'POP' });
        }
      }
    },
  };

  return history;
}

describe('observeHistory', () => {
  let history: ReturnType<typeof createMockHistory>;

  beforeEach(() => {
    history = createMockHistory();
  });

  describe('INIT event', () => {
    it('emits INIT with current location on first subscribe', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];

      observer.subscribe((e) => events.push(e));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ pathname: '/initial', search: '', action: 'INIT' });

      observer.unpatch();
    });

    it('emits INIT only once across multiple subscribers', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];

      observer.subscribe((e) => events.push(e));
      observer.subscribe((e) => events.push(e));

      // INIT fires once, both listeners receive it = 2 calls, but INIT emit happens only once
      const initEvents = events.filter((e) => e.action === 'INIT');
      // First subscribe emits INIT to 1 listener (1 event).
      // Second subscribe does NOT re-emit INIT.
      expect(initEvents).toHaveLength(1);

      observer.unpatch();
    });
  });

  describe('PUSH event', () => {
    it('emits PUSH when history.push is called with a string', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));

      // Clear INIT
      events.length = 0;

      history.push('/users/42?tab=profile');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ pathname: '/users/42', search: '?tab=profile', action: 'PUSH' });

      observer.unpatch();
    });

    it('emits PUSH when history.push is called with an object', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      history.push({ pathname: '/about', search: '?ref=nav' });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ pathname: '/about', search: '?ref=nav', action: 'PUSH' });

      observer.unpatch();
    });

    it('calls the original push method', () => {
      const originalPush = history.push;
      const observer = observeHistory(history);
      observer.subscribe(() => {});

      history.push('/test', { some: 'state' });

      expect(originalPush).toHaveBeenCalledWith('/test', { some: 'state' });

      observer.unpatch();
    });
  });

  describe('REPLACE event', () => {
    it('emits REPLACE when history.replace is called', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      history.replace('/login');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ pathname: '/login', search: '', action: 'REPLACE' });

      observer.unpatch();
    });

    it('calls the original replace method', () => {
      const originalReplace = history.replace;
      const observer = observeHistory(history);
      observer.subscribe(() => {});

      history.replace('/redirect');

      // The patched replace passes (path, state) — state is undefined
      expect(originalReplace).toHaveBeenCalledWith('/redirect', undefined);

      observer.unpatch();
    });
  });

  describe('POP event (history v5)', () => {
    it('emits POP on back/forward navigation', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      history._simulatePop('/previous-page', '?q=1');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ pathname: '/previous-page', search: '?q=1', action: 'POP' });

      observer.unpatch();
    });
  });

  describe('POP event (history v4)', () => {
    it('emits POP with v4 callback signature', () => {
      const v4History = createMockHistory({ v4: true });
      const observer = observeHistory(v4History);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      v4History._simulatePop('/v4-page', '?mode=compat');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ pathname: '/v4-page', search: '?mode=compat', action: 'POP' });

      observer.unpatch();
    });
  });

  describe('parse string/object args', () => {
    it('parses plain pathname string', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      history.push('/simple');

      expect(events[0].pathname).toBe('/simple');
      expect(events[0].search).toBe('');

      observer.unpatch();
    });

    it('parses object with pathname only', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      history.replace({ pathname: '/settings' });

      expect(events[0].pathname).toBe('/settings');
      expect(events[0].search).toBe('');

      observer.unpatch();
    });
  });

  describe('idempotency (WeakMap)', () => {
    it('returns the same observer for the same history object', () => {
      const obs1 = observeHistory(history);
      const obs2 = observeHistory(history);

      expect(obs1).toBe(obs2);

      obs1.unpatch();
    });

    it('returns different observers for different history objects', () => {
      const history2 = createMockHistory();
      const obs1 = observeHistory(history);
      const obs2 = observeHistory(history2);

      expect(obs1).not.toBe(obs2);

      obs1.unpatch();
      obs2.unpatch();
    });
  });

  describe('unpatch()', () => {
    it('restores original push and replace methods', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      // Before unpatch — push emits events
      history.push('/before');
      expect(events).toHaveLength(1);
      events.length = 0;

      observer.unpatch();

      // After unpatch — push/replace no longer emit observer events
      history.push('/after');
      history.replace('/after2');
      expect(events).toHaveLength(0);
    });

    it('calls unlisten from history.listen', () => {
      const observer = observeHistory(history);
      observer.subscribe(() => {});

      expect(history._listeners).toHaveLength(1);

      observer.unpatch();

      expect(history._listeners).toHaveLength(0);
    });

    it('clears all listeners — no events after unpatch', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      observer.unpatch();

      // Push on restored method — no observer events
      history.push('/after-unpatch');
      expect(events).toHaveLength(0);
    });

    it('is idempotent — calling twice does not throw', () => {
      const observer = observeHistory(history);
      observer.unpatch();
      expect(() => observer.unpatch()).not.toThrow();
    });

    it('allows creating a new observer after unpatch', () => {
      const obs1 = observeHistory(history);
      obs1.unpatch();

      const obs2 = observeHistory(history);
      expect(obs2).not.toBe(obs1);

      const events: NavigationEvent[] = [];
      obs2.subscribe((e) => events.push(e));

      expect(events).toHaveLength(1); // new INIT
      expect(events[0].action).toBe('INIT');

      obs2.unpatch();
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('unsubscribe removes the listener', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];

      const unsub = observer.subscribe((e) => events.push(e));
      events.length = 0;

      unsub();

      history.push('/ignored');
      expect(events).toHaveLength(0);

      observer.unpatch();
    });

    it('multiple listeners all receive events', () => {
      const observer = observeHistory(history);
      const events1: NavigationEvent[] = [];
      const events2: NavigationEvent[] = [];

      observer.subscribe((e) => events1.push(e));
      observer.subscribe((e) => events2.push(e));

      events1.length = 0;
      events2.length = 0;

      history.push('/multi');

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0].pathname).toBe('/multi');

      observer.unpatch();
    });

    it('error in one listener does not break others', () => {
      const observer = observeHistory(history);
      const events: NavigationEvent[] = [];

      observer.subscribe(() => { throw new Error('boom'); });
      observer.subscribe((e) => events.push(e));
      events.length = 0;

      history.push('/resilient');

      expect(events).toHaveLength(1);
      expect(events[0].pathname).toBe('/resilient');

      observer.unpatch();
    });
  });
});
