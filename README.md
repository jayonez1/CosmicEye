# CosmicEye

A set of RUM metrics for SPAs. Two independent modules:

- **RDR** (RUM Duplicate Requests) — detects and logs duplicate API requests.
- **RT** (Route Transition Metrics) — measures route transition timing (render + TTI).

**Key properties:**

- Zero runtime dependencies for the core (React is an optional peer for extensions)
- RDR: deterministic sampling ~5% in production, always enabled in dev
- RT: dev-only, measures `route_render_ms` and `route_tti_ms`
- `RouteTracker` — "dumb" React provider for both modules (post-render)
- `observeHistory` — neutral pre-render navigation observer (history v4/v5)

## Installation

```bash
npm install cosmic-eye
```

## Quick start

### RDR

```ts
import rdr, { initRDR } from 'cosmic-eye';

initRDR();
rdr.reqHandler({ s: 'UserService', m: 'getProfile', p: { id: 42 }, b: {} });
```

### RT + observeHistory + RouteTracker

```ts
import { initRT, rt, observeHistory } from 'cosmic-eye';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();
initRT();

// Pre-render: observer emits navigation events before React render
const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);
  rdr.resetTiming();
  rdr.resetActions();
});
```

```tsx
import { RouteTracker } from 'cosmic-eye/react';

// Post-render: RouteTracker fires after React commit
<Router history={history}>
  <RouteTracker
    onRouteChange={[
      (pathname) => { rt.markRendered(pathname); },
    ]}
  >
    <Switch>...</Switch>
  </RouteTracker>
</Router>
```

## How duplicate detection works

1. Each incoming payload is hashed into a `reqHash` (combining endpoint + params hash + body hash)
2. If the same `reqHash` was seen within `TIMINGS.DUPLICATE_THRESHOLD_MS` (default 1 000 ms), a log entry is created
3. Log entries accumulate in a buffer and are flushed:
   - Every `FLUSH.INTERVAL_MS` (15 s)
   - When buffer reaches `FLUSH.MAX_EVENTS` (50)
   - On `visibilitychange` (tab hidden)
   - On `pagehide` (page close)
   - On `destroy()`

## Sampling

In **production** (`NODE_ENV=production`), only ~5% of users are sampled. The decision is deterministic and stable across page reloads — a client ID is persisted in `localStorage` under key `rum_user_id`, hashed, and checked against the sampling rate.

In **development** (`NODE_ENV !== 'production'`), sampling is always enabled.

## API

### RDR

| Function | Description |
|----------|-------------|
| `initRDR()` | Initialize. Safe to call multiple times. |
| `rdr.reqHandler(payload)` | Pass an API request. `{ s, m, p?, b? }` |
| `rdr.resetTiming()` | Reset timer (SPA route change) |
| `rdr.resetActions()` | Clear action buffer |
| `rdr.destroy()` | Stop timers, flush, clean up |

### RT

| Function | Description |
|----------|-------------|
| `initRT()` | Enable module (dev-only) |
| `rt.startTransition(pathname, search)` | Start transition timing (pre-render) |
| `rt.markRendered(pathname)` | Mark route render (post-render) |
| `trackCritical(promise?)` | Track a critical async operation |
| `rt.destroy()` | Clean up |

### observeHistory

| Function | Description |
|----------|-------------|
| `observeHistory(history)` | Create observer (idempotent via WeakMap) |
| `observer.subscribe(listener)` | Subscribe to `INIT/PUSH/REPLACE/POP`. Returns `unsubscribe` |
| `observer.unpatch()` | Remove patch, clean up |

### RouteTracker (`cosmic-eye/react`)

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Child elements |
| `onRouteChange` | `Array<(pathname, search) => void>` | Callbacks on route change |

See [src/rdr/README.md](src/rdr/README.md) and [src/rt/README.md](src/rt/README.md) for log schemas and configuration reference.

## Project structure

```
src/
  index.ts              — public API (re-exports only, no React)
  react.ts              — React extensions entry point (cosmic-eye/react)
  rdr/                  — RDR module: duplicate request detection
  rt/                   — RT module: route transition metrics
  extensions/
    history-route-observer/ — navigation observer (pre-render)
    route-tracker/      — RouteTracker React component (post-render)
tests/
  rdr/                  — RDR tests (49)
  rt/                   — RT tests (19)
  extensions/           — extension tests (32)
```

## Test commands

| Command | Scope |
|---------|-------|
| `npm run test` | all tests |
| `npm run test:rdr` | RDR only |
| `npm run test:rt` | RT only |
| `npm run test:extensions` | extensions only |
| `npm run test:watch` | all, watch mode |

## Documentation

Each module has its own README with integration guide, configuration reference, and event schema:

- [src/rdr/README.md](src/rdr/README.md) — RDR documentation
- [src/rt/README.md](src/rt/README.md) — RT documentation
- [src/extensions/history-route-observer/README.md](src/extensions/history-route-observer/README.md) — observer documentation
- [src/extensions/route-tracker/README.md](src/extensions/route-tracker/README.md) — RouteTracker documentation
- [CHANGELOG.md](CHANGELOG.md) — change history

## License

MIT
