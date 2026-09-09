import { describe, expect, it, vi } from 'vitest';
import { observeHistory } from '../../../src/extensions/history-route-observer';
import type { HistoryLike } from '../../../src/extensions/history-route-observer';

describe('query/hash-only history navigation', () => {
  it.each(['push', 'replace'] as const)('keeps the current pathname for %s', (method) => {
    const history: HistoryLike = {
      location: { pathname: '/catalog/items', search: '?page=1' },
      push: vi.fn(),
      replace: vi.fn(),
      listen: () => () => {},
    };
    const original = history[method];
    const observer = observeHistory(history);
    const listener = vi.fn();
    observer.subscribe(listener);
    listener.mockClear();

    try {
      history[method]('?page=2');
      history[method]('#details');

      expect(listener.mock.calls.map(([event]) => event)).toEqual([
        { pathname: '/catalog/items', search: '?page=2', action: method.toUpperCase() },
        { pathname: '/catalog/items', search: '', action: method.toUpperCase() },
      ]);
      expect(original).toHaveBeenNthCalledWith(1, '?page=2', undefined);
      expect(original).toHaveBeenNthCalledWith(2, '#details', undefined);
    } finally {
      observer.unpatch();
    }
  });
});
