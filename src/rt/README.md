# RT — Route Transition Metrics

Measures SPA route transition timing: render time (`routeRenderMs`) and Time To Interactive (`routeTtiMs`). Activation is controlled via config — no implicit dev/production branching.

## Integration

### Architecture: pre-render vs post-render

```
history.push('/page')
  → observeHistory: emit PUSH → rt.startTransition()   ← pre-render
  → React renders <Page />
  → RouteRenderObserver: useLayoutEffect → rt.markRendered()   ← post-render
  → 2×rAF + idle → TTI
```

### Step 1: Install

```bash
npm install cosmic-eye
```

### Step 2: Initialize + observer

This example uses React Router DOM 5.1+ (v5) and `history@4`. Use the same history instance in the router and observer; install `history@4` as a direct dependency if needed.

```ts
// metrics.ts — import before rendering the application
import { initRT, rt } from 'cosmic-eye';
import { observeHistory } from 'cosmic-eye/extensions';
import { createBrowserHistory } from 'history';

export const history = createBrowserHistory();

const ok = initRT({
  samplingRate: 1,
  send: (payload) => myAnalytics.send('rt', payload),
  includePathname: true,
  tag: 'my-app',
});
// ok === true if initialized, false if sampling excluded

const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);
});
```

`initRT()` returns `boolean` — `true` if RT was activated, `false` if not (e.g. sampling excluded). The first sampling decision is retained for the page load: subsequent calls do not rerun sampling, including when the result was `false`.

### Step 3: Connect RouteRenderObserver (post-render)

RT measures the initial route and changes of `pathname`. Repeated `startTransition()` calls with the same pathname return `{ initialized: true, started: false }`, whether the previous measurement is pending, completed, or timed out. Query-only navigation preserves that measurement and its original `search`, and does not start a timeout. `observeHistory` still emits every navigation event. Calling `abortPending()`, or `destroy()` followed by `init()`, clears the transition and allows the same pathname to be measured again.

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

`children` is your route tree. Mount this router once at the application root. Other router versions need their own navigation integration; the `Router history` API above is specific to v5.

### Step 4: Track critical operations (optional)

```ts
import { rt } from 'cosmic-eye';

// Option 1: with Promise
const request = fetchData();
const result = rt.trackCritical(request);
// result: { initialized, tracked }
await request; // Handle request errors in the application's normal error flow.

// Option 2: manual control
const { done } = rt.trackCritical();
try {
  await fetchData();
} finally {
  done?.();
}
```

Promise fulfillment and rejection both finish the critical operation. RT handles rejection of its own internal Promise chain; the application still receives and handles the original request rejection.

### Step 5: Abort pending transition (optional)

```ts
rt.abortPending('user-navigated-away');
// returns { initialized, aborted }
```

### Step 6: Cleanup (optional)

```ts
observer.unpatch();
rt.destroy();
// returns { initialized: false, destroyed: true }
```

`destroy()` retains configuration, including `send`, `tag`, and the sampling decision. After `destroy()`, `init(config)` updates supplied settings and keeps omitted ones. Calling `init()` while active ignores new configuration.

---

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `init(config?)` | `boolean` | Initialize with optional config. Returns `true` if active. |
| `isInitialized()` | `boolean` | Check if RT is currently active. |
| `startTransition(pathname, search?)` | `RtStartTransitionResult` | Start tracking the initial route or a different pathname; the same pathname returns `started: false`. |
| `markRendered(pathname)` | `RtMarkRenderedResult` | Mark render completion for matching pathname. |
| `trackCritical(promise?)` | `RtTrackCriticalResult` | Track a critical operation. Returns `done` for manual mode. |
| `abortPending(reason?)` | `RtAbortPendingResult` | Abort current transition and send abort event. |
| `destroy()` | `RtDestroyResult` | Clear state and timers. |

Except for `init()` and `isInitialized()`, which return booleans, public methods return **result objects** with an `initialized` field.

---

## Configuration — `RtConfig`

All fields are optional. Defaults apply on first initialization; after `destroy()`, omitted fields keep their previous values.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `samplingRate` | `number` | `1` (100%) | Finite page-load sampling rate (0..1), passed to `samplingFn` when provided. |
| `samplingFn` | `SamplingFn` | — | Synchronous `(samplingRate: number) => boolean`; replaces random sampling, including at rates 0/1. |
| `criticalTimeoutMs` | `number` | `20_000` | Max TTI wait time (ms). |
| `idleTimeoutMs` | `number` | `1_500` | `requestIdleCallback` timeout (ms). |
| `rafCount` | `number` | `2` | rAF cycles before idle check. |
| `includePathname` | `boolean` | `false` | Include `pathname` in payload. |
| `includeSearch` | `boolean` | `false` | Include `search` in payload. |
| `send` | `RtSendFn` | `console.log` | Custom send function. |
| `enrichers` | `Enricher[]` | — | Sync getters for payload enrichment. |
| `enricherLimits` | `Partial<EnricherLimitsConfig>` | — | Limits for enricher output. |
| `tag` | `string` | — | Custom tag added to every log entry. |
| `chromeExtensionEvents` | `boolean` | `false` | Dispatch `CustomEvent('rt', ...)` for Chrome extension. |

`send` may return a Promise, but RT does not await it, handle its rejection, or retry delivery. The consumer is responsible for handling asynchronous delivery errors. Synchronous exceptions thrown by `send` are caught by the library's existing `try/catch`.

### Sampling

Without `samplingFn`, RT uses `Math.random() < samplingRate` once per page load. Both `true` and `false` are retained in memory across repeated `init`, route changes, and `destroy()`/`init`. Sampling options from later calls are ignored. No storage is used.

`destroy()` stops collection but retains the sampling decision. A subsequent `init` can restart an accepted module; a rejected module stays disabled until a full page reload.

A custom function receives the rate and must synchronously return `true` to enable collection; exceptions and non-boolean results disable collection. Invalid rates disable collection without calling the function. RDR and RT decide independently. For custom user-based selection and migration from `clientId`/`samplingStorageKey`, see [Sampling](../../README.md#sampling).

---

## Event Schema — RTLogEntry

| Field | Type | Description |
|-------|------|-------------|
| `ver` | `string` | Schema version (`'0.1'`). |
| `id` | `string` | Unique transition ID. |
| `routeName` | `string` | Normalized path (`/users/:id`). |
| `routeRenderMs` | `number \| null` | Render time (ms). `null` if not rendered. |
| `routeTtiMs` | `number \| null` | TTI (ms). `null` if not measured. |
| `pathname` | `string` (optional) | Original path. Only if `includePathname: true`. |
| `search` | `string` (optional) | Query string. Only if `includeSearch: true`. |
| `timedOut` | `boolean` (optional) | `true` if critical timeout expired. |
| `aborted` | `boolean` (optional) | `true` if transition was aborted. |
| `abortReason` | `string` (optional) | Reason passed to `abortPending()`. |
| `tag` | `string` (optional) | Custom metric tag from config. |
| `enrichments` | `Record<string, unknown>` (optional) | Enricher outputs. |

### Example

```json
{
  "ver": "0.1",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "routeName": "/users/:id",
  "routeRenderMs": 45,
  "routeTtiMs": 120,
  "pathname": "/users/123",
  "search": "?tab=settings",
  "tag": "my-app"
}
```

### Abort example

```json
{
  "ver": "0.1",
  "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "routeName": "/reports/:id",
  "routeRenderMs": null,
  "routeTtiMs": null,
  "aborted": true,
  "abortReason": "user-navigated-away"
}
```
