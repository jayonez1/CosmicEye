# CosmicEye

RUM metrics toolkit for SPAs: duplicate request detection and route transition timing.  
Two independent modules + extensions:

- **RDR** (RUM Duplicate Requests) — detects and logs duplicate API requests.
- **RT** (Route Transition Metrics) — measures route transition timing (render + TTI).
- **Extensions** — `observeHistory`, `RouteRenderObserver`, `mobxSpy`.

### Entry points

| Import path | Contents |
|-------------|----------|
| `cosmic-eye` | RDR + RT + shared hash utils + observeHistory + mobxSpy (no React) |
| `cosmic-eye/rdr` | RDR only |
| `cosmic-eye/rt` | RT only |
| `cosmic-eye/extensions` | observeHistory + mobxSpy (no React) |
| `cosmic-eye/react` | RouteRenderObserver (requires React + react-router-dom) |

Existing imports from `cosmic-eye`, including `observeHistory`, `mobxSpy`, and their types, remain supported. Sub-path imports are optional:

```ts
import rdr, { initRDR } from 'cosmic-eye/rdr';
import rt, { initRT } from 'cosmic-eye/rt';
import { observeHistory, mobxSpy } from 'cosmic-eye/extensions';
```

The `rdr` and `rt` objects are default exports from their sub-paths and named exports from `cosmic-eye`. Both paths share the same instances.

## Installation

```bash
npm install cosmic-eye
```

The published package targets ES2020 and supports consumer projects using Node.js 14 or newer. It is ESM-only. The React entry point requires React >= 16.8 and React Router DOM >= 5.1; the core entry points do not require React. MobX is supplied by the application through `mobxSpy.init({ spy })`.

Consumer installation, browser bundling, and runtime integration were verified on Node.js 14.21.3 with React / React DOM 17.0.2, React Router DOM 5.2.0, MobX 6.3.12, and mobx-react 7.2.1. The full stack's declarations were checked with TypeScript 4.7.4.

Development of this repository (dependency installation, tests, linting, and builds) uses Node.js 20. These development tools are not installed with the published package.

## Chrome DevTools Extension

- [CosmicEye Chrome Extension](https://github.com/jayonez1/CosmicEye-chrome-extension) — companion DevTools panel for real-time RDR/RT monitoring.

## Quick start

### RDR

```ts
import { rdr, initRDR } from 'cosmic-eye';

const ok = initRDR({ samplingRate: 0.15, send: (p) => analytics.send('rdr', p) });

// RPC-style
rdr.reqHandlerRpc({ s: 'UserService', m: 'getProfile', p: { id: 42 }, b: {} });
// HTTP-style
rdr.reqHandlerHttp({ httpMethod: 'GET', endpoint: '/api/users/42' });
```

### RT + observeHistory + RouteRenderObserver

This example uses React Router DOM 5.1+ (v5) with `history@4`. The router and `observeHistory` must use the same history instance. Install `history@4` as a direct dependency if needed.

```ts
// metrics.ts — import before rendering the application
import { initRT, rt } from 'cosmic-eye';
import { observeHistory } from 'cosmic-eye/extensions';
import { createBrowserHistory } from 'history';

export const history = createBrowserHistory();
initRT({ send: (p) => analytics.send('rt', p), includePathname: true });

const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);
});
```

```tsx
// App.tsx
import { Router } from 'react-router-dom';
import { RouteRenderObserver } from 'cosmic-eye/react';
import { rt } from 'cosmic-eye';
import { history } from './metrics';

<Router history={history}>
  <RouteRenderObserver
    onRouteChange={[(pathname) => { rt.markRendered(pathname); }]}
  >
    {children}
  </RouteRenderObserver>
</Router>
```

`children` is your application's route tree. Mount this router once at the application root. For other router versions, use their navigation integration to call `rt.startTransition()` before render; the v5 `Router history` API above is version-specific.

### Sending metrics and reinitialization

RDR and RT do not await, retry, or handle rejections of Promises returned by `send`. The consumer is responsible for handling asynchronous delivery errors, including reporting them when needed. Synchronous exceptions thrown by `send` are caught by the library's existing `try/catch`.

`destroy()` stops collection but retains configuration, including `send`, `tag`, and the sampling decision. After `destroy()`, `init(config)` updates supplied settings and keeps omitted ones; `init()` on an active module ignores new configuration. Sampling options are always retained for the page load.

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

1. On initial navigation or a change of `pathname`, call `startTransition(pathname, search?)` — RT creates a transition ID, stores the start time, and normalizes `routeName`. Calls with the same pathname return `started: false`, including query-only navigation, and preserve the existing measurement.
2. After route commit, call `markRendered(pathname)` — RT records render completion time.
3. If there is critical async work, use `trackCritical()` — RT waits until all critical tasks are finished.
4. RT marks the transition as interactive after `rafCount` frames + idle wait (`idleTimeoutMs`), then sends a `transition` event.
5. The event includes `routeRenderMs` and `routeTtiMs` (and optional `pathname` / `search` if enabled in config).
6. If interactive state is not reached before `criticalTimeoutMs` (default 20 s), RT still sends the event with `timedOut: true`.
7. `abortPending(reason?)` sends an `abort` event; `destroy()` stops tracking and clears timers.

Query changes do not produce separate RT measurements. The optional `search` field describes the URL at the start of a measured pathname transition. After `abortPending()` clears a transition, or after `destroy()`/`init`, the same pathname can be measured again.


## Sampling

Both RDR and RT accept two sampling options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `samplingRate` | `number` | `1` (100%) | A finite number from 0 to 1. |
| `samplingFn` | `(samplingRate: number) => boolean` | — | Optional synchronous function that makes the entire sampling decision. |

Without `samplingFn`, the first `init` uses `Math.random() < samplingRate`. For example, `0.15` selects approximately 15% of page loads, not 15% of unique users or individual requests. At `0` collection is disabled; at `1` it is enabled for every page load. No `localStorage` or `sessionStorage` is accessed by sampling.

Each module stores its decision (`true` or `false`) in memory for the lifetime of its instance. Repeated `init` calls, SPA navigation, and `destroy()` followed by `init` do not run sampling again or apply new sampling options. A full page reload creates a new instance and a new decision. RDR and RT make independent decisions; imports from the main entry point and sub-paths use the same module instances.

When `samplingFn` is provided, it receives the rate (including the default `1`) and its result replaces random sampling, even at rates `0` and `1`. Only `true` enables collection; exceptions or non-boolean results disable it. Async functions are not supported. An invalid rate disables collection without calling the function. With a custom function, the consumer is responsible for respecting the requested percentage.

For example, a product with a known user ID can provide deterministic sampling and share the selection across RDR and RT:

```ts
import { hashText, initRDR, initRT, type SamplingFn } from 'cosmic-eye';

const userId = 'user-123'; // Replace with the product's user ID before init.
const samplingFn: SamplingFn = (rate) => {
  const bucket = (parseInt(hashText(userId), 16) % 10_000) / 10_000;
  return bucket < rate;
};

initRDR({ samplingRate: 0.15, samplingFn });
initRT({ samplingRate: 0.15, samplingFn });
```

`clientId` and `samplingStorageKey` were removed in 1.0. Products that need persistent IDs or storage-based selection can implement them inside `samplingFn`. Existing stored IDs are left untouched. See the [1.0 migration notes](CHANGELOG.md#100) for upgrading from the previous 5% default.

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
  index.ts              — main entry: RDR + RT + shared hash utils + non-React extensions
  react.ts              — React extensions entry (cosmic-eye/react)
  shared/               — shared utilities (time, hash, sampling, enrichers, env)
  rdr/                  — RDR module (cosmic-eye/rdr)
  rt/                   — RT module (cosmic-eye/rt)
  extensions/
    index.ts               — extensions entry (cosmic-eye/extensions)
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
