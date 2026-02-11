# RouteRenderObserver

React component for **post-render** route change tracking in SPAs.

## Purpose

`RouteRenderObserver` is a "dumb" provider. It has **no knowledge** of any other module.
Its only job: detect `pathname` changes via `useLocation()` and call registered callbacks **after** React commit.

## API

```tsx
import { RouteRenderObserver } from 'cosmic-eye/react';

<RouteRenderObserver onRouteChange={[callback1, callback2]}>
  {children}
</RouteRenderObserver>
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
import { RouteRenderObserver } from 'cosmic-eye/react';
import { BrowserRouter } from 'react-router-dom';

<BrowserRouter>
  <RouteRenderObserver
    onRouteChange={[
      (pathname) => { console.log('route changed:', pathname); },
    ]}
  >
    {/* your router tree (v5: Switch/Route, v6: Routes/Route) */}
  </RouteRenderObserver>
</BrowserRouter>
```

## Requirements

- `react` >= 16.8.0 (hooks)
- `react-router-dom` >= 5.0.0 (`useLocation`)
