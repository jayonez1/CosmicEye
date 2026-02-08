import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render } from '@testing-library/react';

// Mock react-router-dom's useLocation
let mockLocation = { pathname: '/home', search: '', hash: '', state: null, key: 'default' };

vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
}));

import { RouteTracker } from '../../../src/extensions/route-tracker';

beforeEach(() => {
  mockLocation = { pathname: '/home', search: '', hash: '', state: null, key: 'default' };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RouteTracker', () => {
  it('renders children', () => {
    const { container } = render(
      createElement(RouteTracker, {
        onRouteChange: [],
        children: createElement('div', { 'data-testid': 'child' }, 'Hello'),
      }),
    );

    expect(container.textContent).toBe('Hello');
  });

  it('calls onRouteChange callbacks on initial mount', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    render(
      createElement(RouteTracker, {
        onRouteChange: [cb1, cb2],
        children: createElement('div'),
      }),
    );

    expect(cb1).toHaveBeenCalledWith('/home', '');
    expect(cb2).toHaveBeenCalledWith('/home', '');
  });

  it('calls onRouteChange when pathname changes', () => {
    const cb = vi.fn();

    const { rerender } = render(
      createElement(RouteTracker, {
        onRouteChange: [cb],
        children: createElement('div'),
      }),
    );

    expect(cb).toHaveBeenCalledTimes(1);
    cb.mockClear();

    // Simulate route change
    mockLocation = { ...mockLocation, pathname: '/about', search: '?tab=1' };

    rerender(
      createElement(RouteTracker, {
        onRouteChange: [cb],
        children: createElement('div'),
      }),
    );

    expect(cb).toHaveBeenCalledWith('/about', '?tab=1');
  });

  it('does NOT call onRouteChange when pathname stays the same', () => {
    const cb = vi.fn();

    const { rerender } = render(
      createElement(RouteTracker, {
        onRouteChange: [cb],
        children: createElement('div'),
      }),
    );

    cb.mockClear();

    // Same pathname, different search
    mockLocation = { ...mockLocation, search: '?page=2' };

    rerender(
      createElement(RouteTracker, {
        onRouteChange: [cb],
        children: createElement('div'),
      }),
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it('catches errors in callbacks without breaking other listeners', () => {
    const failing = vi.fn(() => { throw new Error('boom'); });
    const succeeding = vi.fn();

    render(
      createElement(RouteTracker, {
        onRouteChange: [failing, succeeding],
        children: createElement('div'),
      }),
    );

    expect(failing).toHaveBeenCalled();
    expect(succeeding).toHaveBeenCalled();
  });

  it('works without onRouteChange prop', () => {
    expect(() => {
      render(createElement(RouteTracker, { children: createElement('div') }));
    }).not.toThrow();
  });
});
