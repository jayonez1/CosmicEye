# CosmicEye

A set of RUM metrics for SPAs. Two independent modules + extensions:

- **RDR** (RUM Duplicate Requests) — detects and logs duplicate API requests.
- **RT** (Route Transition Metrics) — measures route transition timing (render + TTI).
- **Extensions** — `observeHistory`, `RouteRenderObserver`, `mobxSpy`.

## Installation

```bash
npm install cosmic-eye
```

## Quick start

### RDR

```ts
import { rdr, initRDR } from 'cosmic-eye';

const ok = initRDR({ samplingRate: 0.05, send: (p) => analytics.send('rdr', p) });

// RPC-style
rdr.reqHandlerRpc({ s: 'UserService', m: 'getProfile', p: { id: 42 }, b: {} });
// HTTP-style
rdr.reqHandlerHttp({ httpMethod: 'GET', endpoint: '/api/users/42' });
```

### RT + observeHistory + RouteRenderObserver

```ts
import { initRT, rt, observeHistory } from 'cosmic-eye';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();
initRT({ send: (p) => analytics.send('rt', p), includePathname: true });

const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);
});
```

```tsx
import { RouteRenderObserver } from 'cosmic-eye/react';

<RouteRenderObserver
  onRouteChange={[(pathname) => { rt.markRendered(pathname); }]}
>
  {children}
</RouteRenderObserver>
```

## How duplicate detection works

1. Each incoming payload is hashed into a `reqHash` (FNV-1a of endpoint + params + body)
2. If the same `reqHash` was seen within `duplicateThresholdMs` (default 1 000 ms), a log entry is created
3. Log entries accumulate in a buffer and are flushed:
   - Every `flushIntervalMs` (15 s)
   - When buffer reaches `flushMaxEvents` (50)
   - On `visibilitychange` (tab hidden)
   - On `pagehide` (page close)
   - On `destroy()` or `flush()`

## How route transition tracking works

1. On navigation, call `startTransition(pathname, search?)` — RT creates a transition ID, stores the start time, and normalizes `routeName`.
2. After route commit, call `markRendered(pathname)` — RT records render completion time.
3. If there is critical async work, use `trackCritical()` — RT waits until all critical tasks are finished.
4. RT marks the transition as interactive after `rafCount` frames + idle wait (`idleTimeoutMs`), then sends a `transition` event.
5. The event includes `routeRenderMs` and `routeTtiMs` (and optional `pathname` / `search` if enabled in config).
6. If interactive state is not reached before `criticalTimeoutMs` (default 20 s), RT still sends the event with `timedOut: true`.
7. `abortPending(reason?)` sends an `abort` event; `destroy()` stops tracking and clears timers.


## Sampling

Sampling is **config-driven** via `samplingRate` (0..1). Default is `0.05` (5%). The decision is deterministic when a stable client ID is available (`clientId` from config or persisted `localStorage`). If storage is unavailable and no explicit `clientId` is provided, fallback ID generation may produce non-deterministic results between calls.

## API

### RDR

| Function | Returns | Description |
|----------|---------|-------------|
| `initRDR(config?)` | `boolean` | Initialize with optional config. |
| `rdr.isInitialized()` | `boolean` | Check if active. |
| `rdr.reqHandlerRpc(payload)` | `RdrReqHandlerResult` | Process RPC request. |
| `rdr.reqHandlerHttp(payload)` | `RdrReqHandlerResult` | Process HTTP request. |
| `rdr.flush(trigger?, meta?)` | `RdrFlushResult` | Manual flush. |
| `rdr.resetTiming()` | `RdrResetTimingResult` | Reset page load timestamp. |
| `rdr.resetActions()` | `RdrResetActionsResult` | Clear action buffer. |
| `rdr.destroy()` | `RdrDestroyResult` | Stop, flush, clean up. |

### RT

| Function | Returns | Description |
|----------|---------|-------------|
| `initRT(config?)` | `boolean` | Initialize with optional config. |
| `rt.isInitialized()` | `boolean` | Check if active. |
| `rt.startTransition(pathname, search?)` | `RtStartTransitionResult` | Start transition timing. |
| `rt.markRendered(pathname)` | `RtMarkRenderedResult` | Mark render completion. |
| `rt.trackCritical(promise?)` | `RtTrackCriticalResult` | Track critical operation. |
| `rt.abortPending(reason?)` | `RtAbortPendingResult` | Abort active transition. |
| `rt.destroy()` | `RtDestroyResult` | Clean up. |

### observeHistory

| Function | Description |
|----------|-------------|
| `observeHistory(history)` | Create observer (idempotent via WeakMap) |
| `observer.subscribe(listener)` | Subscribe to `INIT/PUSH/REPLACE/POP`. Returns `unsubscribe` |
| `observer.unpatch()` | Remove patch, clean up |

### RouteRenderObserver (`cosmic-eye/react`)

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Child elements |
| `onRouteChange` | `Array<(pathname, search) => void>` | Callbacks on route change |

## Project structure

```
src/
  index.ts              — public API (re-exports only, no React)
  react.ts              — React extensions entry point (cosmic-eye/react)
  shared/               — shared utilities (time, hash, sampling, enrichers, env)
  rdr/                  — RDR module: duplicate request detection
  rt/                   — RT module: route transition metrics
  extensions/
    history-route-observer/ — navigation observer (pre-render)
    route-render-observer/  — RouteRenderObserver React component (post-render)
    mobx-spy/              — MobX spy extension (DI-only via `mobxSpy.init({ spy })`)
tests/
  rdr/                  — RDR tests
  rt/                   — RT tests
  extensions/           — extension tests (observer, route-render, mobx-spy)
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
- [src/extensions/route-render-observer/README.md](src/extensions/route-render-observer/README.md) — RouteRenderObserver documentation
- [src/extensions/mobx-spy/README.md](src/extensions/mobx-spy/README.md) — mobxSpy documentation
- [CHANGELOG.md](CHANGELOG.md) — change history

## License

MIT
