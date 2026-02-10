# RouteTracker

React component for **post-render** route change tracking in SPAs.

## Purpose

`RouteTracker` is a "dumb" provider. It has **no knowledge** of RDR, RT, or any other module.
Its only job: detect `pathname` changes via `useLocation()` and call registered callbacks **after** React commit.

> **Pre-render** navigation events (before render) are handled via `observeHistory` — a separate extension. RouteTracker is intended for **post-render** callbacks such as `rt.markRendered()`.

## API

```tsx
import { RouteTracker } from 'cosmic-eye/react';

<RouteTracker onRouteChange={[callback1, callback2]}>
  {children}
</RouteTracker>
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Child elements (typically `<Switch>` / `<Routes>`) |
| `onRouteChange` | `Array<(pathname, search) => void>` | Callbacks invoked on route change |

### Behavior

- Callbacks fire from `useLayoutEffect` — **after** React commit phase.
- Called on **every** `pathname` change, including the initial mount.
- Changes to `search` with the same `pathname` do **not** trigger callbacks (passed as argument).
- Each callback is wrapped in `try/catch` — an error in one does not block others.
- A `ref` is used for callbacks — changing the array does not cause unnecessary re-renders.

## Integration example

```tsx
import { rt } from 'cosmic-eye';
import { RouteTracker } from 'cosmic-eye/react';

<Router history={history}>
  <RouteTracker
    onRouteChange={[
      (pathname) => { rt.markRendered(pathname); },
    ]}
  >
    <Switch>
      <Route path="/home" component={Home} />
    </Switch>
  </RouteTracker>
</Router>
```

> **For pre-render reset** (RDR `resetTiming`, RT `startTransition`) use `observeHistory`:
> ```ts
> import { observeHistory, rt } from 'cosmic-eye';
> const observer = observeHistory(history);
> observer.subscribe(({ pathname, search }) => {
>   rt.startTransition(pathname, search);
>   rdr.resetTiming();
>   rdr.resetActions();
> });
> ```

## Requirements

- `react` >= 16.8.0 (hooks)
- `react-router-dom` >= 5.0.0 (`useLocation`)
