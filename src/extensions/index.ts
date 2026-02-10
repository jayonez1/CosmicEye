// Extensions barrel — re-exports all extension modules

export { RouteTracker } from './route-tracker';
export type { RouteTrackerProps, RouteChangeListener } from './route-tracker';

export { observeHistory } from './history-route-observer';
export type {
  HistoryLike,
  HistoryLocation,
  HistoryRouteObserver,
  NavigationAction,
  NavigationEvent,
  NavigationListener,
} from './history-route-observer';
