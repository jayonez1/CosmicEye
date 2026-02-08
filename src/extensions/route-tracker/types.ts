import type { ReactNode } from 'react';

/** Callback invoked when the route pathname changes. */
export type RouteChangeListener = (pathname: string, search: string) => void;

/** Props for the RouteTracker component. */
export interface RouteTrackerProps {
  children: ReactNode;
  /** Array of callbacks to invoke on every pathname change (including initial mount). */
  onRouteChange?: RouteChangeListener[];
}
