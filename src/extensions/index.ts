// Extensions barrel — re-exports all extension modules

export { RouteRenderObserver } from './route-render-observer';
export type { RouteRenderObserverProps, RouteChangeListener } from './route-render-observer';

export { observeHistory } from './history-route-observer';
export type {
  HistoryLike,
  HistoryLocation,
  HistoryRouteObserver,
  NavigationAction,
  NavigationEvent,
  NavigationListener,
} from './history-route-observer';
