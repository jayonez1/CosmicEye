// Extensions barrel — non-React extensions only.
// React extensions (RouteRenderObserver) are in 'cosmic-eye/react'.

export { observeHistory } from './history-route-observer';
export type {
  HistoryLike,
  HistoryLocation,
  HistoryRouteObserver,
  NavigationAction,
  NavigationEvent,
  NavigationListener,
} from './history-route-observer';

export { mobxSpy } from './mobx-spy';
export type {
  MobxSpySnapshot,
  MobxSpyConfig,
  MobxActionEntry,
  MobxReactionEntry,
} from './mobx-spy';
