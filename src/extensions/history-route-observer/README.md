# history-route-observer

**Pre-render** navigation observer for the `history` library (v4 and v5). Patches `push` and `replace` methods, listens for `POP` events, and emits normalized `NavigationEvent` objects to subscribers.

## Purpose

Provides a single, shared source of navigation events that fires **before** React render. Any number of subscribers can listen to the same observer without redundant history patching.

- **Fully neutral** — has no knowledge of any other module.
- **Idempotent** via `WeakMap` — calling `observeHistory` twice with the same `history` object returns the same observer.
- **INIT** event emitted once on first subscription (current location).
- **No duplicates** — `PUSH`/`REPLACE` are emitted by patched methods only; `listen` callback is filtered to `POP` only.

## API

```ts
import { observeHistory } from 'cosmic-eye/extensions';

const observer = observeHistory(history);

const unsub = observer.subscribe(({ pathname, search, action }) => {
  console.log(action, pathname, search);
});

// Later:
unsub();            // remove this listener
observer.unpatch(); // restore original history methods, remove all listeners
```

### `observeHistory(history): HistoryRouteObserver`

Creates (or returns existing) observer for the given `history` object.

### `observer.subscribe(listener): () => void`

Adds a `NavigationListener`. Returns an unsubscribe function.

On the first `subscribe` call, an `INIT` event is emitted with the current location.

### `observer.unpatch(): void`

- Restores original `push` and `replace` methods.
- Calls `unlisten` from `history.listen`.
- Clears all listeners.
- Removes the observer from the internal `WeakMap` (a fresh observer can be created later).
- Idempotent — calling twice is safe.

## Events

Query-only and hash-only navigation still emit events. String inputs such as `?page=2` and `#details` retain the current pathname.

| Action | When |
|--------|------|
| `INIT` | Once, on first `subscribe` call |
| `PUSH` | `history.push()` called |
| `REPLACE` | `history.replace()` called |
| `POP` | Browser back/forward navigation |

### `NavigationEvent`

```ts
interface NavigationEvent {
  pathname: string;
  search: string;
  action: 'PUSH' | 'REPLACE' | 'POP' | 'INIT';
}
```

## history v4 / v5 compatibility

The observer detects the `listen` callback signature automatically:

- **v4**: `callback(location, action)`
- **v5**: `callback({ location, action })`

## Example

When integrating with a router, observe the history instance used by that router. See the [React Router v5 example](../../../README.md#rt--observehistory--routerenderobserver) for complete wiring.

```ts
import { observeHistory } from 'cosmic-eye/extensions';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();
const observer = observeHistory(history);

observer.subscribe(({ pathname, search, action }) => {
  console.log(`[${action}] ${pathname}${search}`);
});
```

## Types

```ts
export type NavigationAction = 'PUSH' | 'REPLACE' | 'POP' | 'INIT';
export interface NavigationEvent { pathname: string; search: string; action: NavigationAction; }
export type NavigationListener = (event: NavigationEvent) => void;
export interface HistoryLike { push; replace; listen; location; }
export interface HistoryLocation { pathname: string; search?: string; }
export interface HistoryRouteObserver { subscribe; unpatch; }
```

## Requirements

- A `history`-like object (from `history` v4 or v5, or any object matching `HistoryLike`).
- No React dependency.
