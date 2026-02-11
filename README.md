# CosmicEye

A set of RUM metrics for SPAs. Two independent modules + extensions:

- **RDR** (RUM Duplicate Requests) — detects and logs duplicate API requests.
- **RT** (Route Transition Metrics) — measures route transition timing (render + TTI).
- **Extensions** — `observeHistory`, `RouteRenderObserver`, `mobxSpy`.

**Key properties:**

- Zero runtime dependencies for the core (React and MobX are optional peers)
- Config-driven sampling, send functions, enrichers, tags
- All public methods return result objects with `initialized` status
- `observeHistory` — neutral pre-render navigation observer (history v4/v5)
- `RouteRenderObserver` — post-render React provider
- `mobxSpy` — MobX spy integration (no-op if MobX absent)

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

## Sampling

Sampling is **config-driven** via `samplingRate` (0..1). Default is `1` (always enabled). The decision is deterministic — a client ID is persisted in `localStorage`, hashed, and checked against the rate.

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

See [src/rdr/README.md](src/rdr/README.md) and [src/rt/README.md](src/rt/README.md) for log schemas and configuration reference.

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
    mobx-spy/              — MobX spy extension (optional peer)
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
