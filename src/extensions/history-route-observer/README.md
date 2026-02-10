# history-route-observer

Neutral **pre-render** navigation observer for the `history` library (v4 and v5). Patches `push` and `replace` methods, listens for `POP` events, and emits normalized `NavigationEvent` objects to subscribers.

## Purpose

Provides a single, shared source of navigation events that fires **before** React render. Both RT and RDR modules can subscribe to the same observer without redundant history patching.

- **No knowledge** of RT, RDR, or any other module — fully neutral.
- **Idempotent** via `WeakMap` — calling `observeHistory` twice with the same `history` object returns the same observer.
- **INIT** event emitted once on first subscription (current location).

## API

```ts
import { observeHistory } from 'cosmic-eye';

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

## Example: RT + RDR combined

```ts
import { initRT, rt, observeHistory } from 'cosmic-eye';
import rdr from 'cosmic-eye';

const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);
  rdr.resetTiming();
  rdr.resetActions();
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
