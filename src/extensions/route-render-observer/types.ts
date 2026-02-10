import type { ReactNode } from 'react';

/** Callback invoked when the route pathname changes. */
export type RouteChangeListener = (pathname: string, search: string) => void;

/** Props for the RouteRenderObserver component. */
export interface RouteRenderObserverProps {
  children: ReactNode;
  /** Array of callbacks to invoke on every pathname change (including initial mount). */
  onRouteChange?: RouteChangeListener[];
}
