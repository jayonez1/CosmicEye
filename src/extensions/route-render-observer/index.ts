import { createElement, Fragment, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { RouteRenderObserverProps, RouteChangeListener } from './types';

/**
 * Post-render route-change provider. Detects pathname changes via react-router's
 * useLocation and calls every listener in onRouteChange with (pathname, search).
 *
 * Fires **after** React commit (useLayoutEffect).
 *
 * The component itself has NO knowledge of any other module —
 * the consumer decides what happens on route change by passing callbacks.
 *
 * @example
 * ```tsx
 * import { RouteRenderObserver } from 'cosmic-eye/react';
 *
 * <RouteRenderObserver
 *   onRouteChange={[
 *     (pathname) => { console.log('route changed:', pathname); },
 *   ]}
 * >
 *   <Switch>...</Switch>
 * </RouteRenderObserver>
 * ```
 */
export function RouteRenderObserver({ children, onRouteChange }: RouteRenderObserverProps) {
  const location = useLocation();
  const prevPathnameRef = useRef<string | null>(null);
  const callbacksRef = useRef<RouteChangeListener[] | undefined>(onRouteChange);
  callbacksRef.current = onRouteChange;

  useLayoutEffect(() => {
    if (prevPathnameRef.current === location.pathname) {
      return;
    }

    prevPathnameRef.current = location.pathname;

    const callbacks = callbacksRef.current;

    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(location.pathname, location.search || '');
        } catch (_) {
          // nothing
        }
      }
    }
  }, [location.pathname]);

  return createElement(Fragment, null, children);
}

export type { RouteRenderObserverProps, RouteChangeListener } from './types';
