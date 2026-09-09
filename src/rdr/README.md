# RDR — RUM Duplicate Requests

Detects and logs duplicate API requests in SPAs. Uses FNV-1a hashing of endpoint + params + body to identify duplicates within a configurable time window.

## Integration

### Step 1: Install

```bash
npm install cosmic-eye
```

### Step 2: Initialize at application startup

Call `initRDR()` as early as possible — before any API requests are sent. Pass an optional config object.

```ts
import { initRDR } from 'cosmic-eye';

const ok = initRDR({
  samplingRate: 0.15,
  send: (payload) => myAnalytics.send('rdr', payload),
  tag: 'my-app-v2',
});
// ok === true if initialized, false if sampling excluded or error
```

`initRDR()` returns `boolean` — `true` if RDR was activated, `false` if not (e.g. sampling excluded). The first sampling decision is retained for the page load: subsequent calls do not rerun sampling, including when the result was `false`.

### Step 3: Pass API requests to a handler

#### RPC-style requests (`reqHandlerRpc`)

```ts
import { rdr } from 'cosmic-eye';

const result = rdr.reqHandlerRpc({ s: 'UserService', m: 'getProfile', p: { id: 42 }, b: {} });
// result: { initialized, processed, duplicate }
```

#### HTTP-style requests (`reqHandlerHttp`)

```ts
const result = rdr.reqHandlerHttp({
  httpMethod: 'GET',
  endpoint: '/api/users/42',
  bodyText: '',
});
```

Except for `init()` and `isInitialized()`, which return booleans, public methods return **result objects** with an `initialized` field. If RDR is not initialized, no work is done and `initialized: false` is returned.

### Step 4: Handle SPA route changes (recommended)

Use the history instance connected to your router, as in the [complete React Router v5 example](../../README.md#rt--observehistory--routerenderobserver).

```ts
import { rdr } from 'cosmic-eye';
import { observeHistory } from 'cosmic-eye/extensions';
import { history } from './metrics';

const observer = observeHistory(history);

observer.subscribe(() => {
  rdr.resetTiming();
  rdr.resetActions();
});
```

### Step 5: Manual flush

```ts
const result = rdr.flush('route-change', { pathname: '/home' });
// result: { initialized, flushed, entriesCount }
```

### Step 6: Cleanup (optional)

```ts
rdr.destroy();
// returns { initialized: false, destroyed: true }
```

`destroy()` stops collection but retains the sampling decision. A subsequent `init` can restart an accepted module; a rejected module stays disabled until a full page reload.

Configuration, including `send` and `tag`, is also retained. After `destroy()`, `init(config)` updates supplied settings and keeps omitted ones. Calling `init()` while active ignores new configuration.

---

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `init(config?)` | `boolean` | Initialize with optional config. Returns `true` if active. |
| `isInitialized()` | `boolean` | Check if RDR is currently active. |
| `reqHandlerRpc(payload)` | `RdrReqHandlerResult` | Process RPC-style request. |
| `reqHandlerHttp(payload)` | `RdrReqHandlerResult` | Process HTTP-style request. |
| `flush(trigger?, meta?)` | `RdrFlushResult` | Manual flush with trigger name and optional metadata. |
| `resetTiming()` | `RdrResetTimingResult` | Reset page load timestamp. |
| `resetActions()` | `RdrResetActionsResult` | Clear user action buffer. |
| `destroy()` | `RdrDestroyResult` | Stop timers, flush, remove listeners, clear state. |

---

## Configuration — `RdrConfig`

All fields are optional. Defaults apply on first initialization; after `destroy()`, omitted fields keep their previous values.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `samplingRate` | `number` | `1` (100%) | Finite page-load sampling rate (0..1), passed to `samplingFn` when provided. |
| `samplingFn` | `SamplingFn` | — | Synchronous `(samplingRate: number) => boolean`; replaces random sampling, including at rates 0/1. |
| `duplicateThresholdMs` | `number` | `1_000` | Duplicate detection window (ms). |
| `cleanupIntervalMs` | `number` | `10_000` | Stale entry cleanup interval (ms). |
| `flushIntervalMs` | `number` | `15_000` | Periodic flush interval (ms). |
| `flushMaxEvents` | `number` | `50` | Max events before auto-flush. |
| `hashLimits` | `Partial<HashLimitsConfig>` | — | Override hash depth/node/string limits. |
| `send` | `RdrSendFn` | `console.log` | Custom send function for flush payloads. |
| `rpcKeyFactory` | `RdrKeyFactory` | — | Custom key factory for RPC requests. |
| `httpKeyFactory` | `RdrKeyFactory` | — | Custom key factory for HTTP requests. |
| `enrichers` | `Enricher[]` | — | Sync getters called during payload formation. |
| `enricherLimits` | `Partial<EnricherLimitsConfig>` | — | Limits for enricher output. |
| `tag` | `string` | — | Custom tag added to every log entry. |
| `chromeExtensionEvents` | `boolean` | `false` | Dispatch `CustomEvent('rdr', ...)` for Chrome extension. |
| `actionsBufferMaxSize` | `number` | `3` | User action buffer size. |
| `actionsTrackedEvents` | `string[]` | `['click', 'keydown', 'touchstart']` | DOM events tracked. |

`send` may return a Promise, but RDR does not await it, handle its rejection, or retry delivery. The consumer is responsible for handling asynchronous delivery errors. Synchronous exceptions thrown by `send` are caught by the library's existing `try/catch`. `flush().flushed` reports a drained buffer, not confirmed delivery.

### Sampling

Without `samplingFn`, RDR uses `Math.random() < samplingRate` once per page load. Both `true` and `false` are retained in memory across repeated `init`, route changes, and `destroy()`/`init`. Sampling options from later calls are ignored. No storage is used.

A custom function receives the rate and must synchronously return `true` to enable collection; exceptions and non-boolean results disable collection. Invalid rates disable collection without calling the function. RDR and RT decide independently. For custom user-based selection and migration from `clientId`/`samplingStorageKey`, see [Sampling](../../README.md#sampling).

### Enrichers

```ts
initRDR({
  enrichers: [
    { name: 'userId', get: (nowMs) => getCurrentUserId() },
    { name: 'mobx', get: (nowMs) => mobxSpy.snapshot(nowMs) },
  ],
});
```

Each getter is called synchronously. If it throws, the entry is `{ error: 'enricher_failed' }`.

---

## Event Schema — RdrLogEntry

| Field | Type | Description |
|-------|------|-------------|
| `ver` | `string` | Schema version (`'0.1'`). |
| `endpoint` | `string` | `{service}.{method}` or `{METHOD}:{url}`. |
| `reqHash` | `string` | Composite FNV-1a hash with truncation mask. |
| `deltaMs` | `number` | Ms between duplicate requests. |
| `timings.timeSincePageLoadMs` | `number` | Ms since init/resetTiming. |
| `timings.timeSinceLastActionMs` | `number \| null` | Ms since last user action. |
| `lastAction` | `ActionData \| null` | Last user interaction. |
| `env` | `EnvSnapshot` | Tab visibility + network info. |
| `tag` | `string` (optional) | Custom metric tag from config. |
| `enrichments` | `Record<string, unknown>` (optional) | Enricher outputs. |

### Example

```json
{
  "ver": "0.1",
  "endpoint": "UserService.getProfile",
  "reqHash": "req_a1b2c3d4_e5f6a7b8_c9d0e1f2_0",
  "deltaMs": 47,
  "timings": {
    "timeSincePageLoadMs": 12340,
    "timeSinceLastActionMs": 250
  },
  "lastAction": {
    "type": "click",
    "rum_id": "profile-refresh-btn"
  },
  "env": {
    "visibility": "visible",
    "net": { "effectiveType": "4g" }
  },
  "tag": "my-app-v2",
  "enrichments": {
    "userId": "user-123"
  }
}
```

### Cookbook: HTTP fetch wrapper

For small text/JSON request bodies. This handles string URLs, `URL`, and `Request`, including `init` overrides. It reads a copy of the body without waiting before starting the actual fetch, so body reading can shift the time recorded by RDR. Avoid this wrapper for large or streaming uploads; call `reqHandlerHttp` with known request data at the API-client layer instead.

```ts
import { rdr } from 'cosmic-eye';

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  try {
    // Do not read a shared upload stream or binary/form body from init.
    const body = init?.body;
    if (body == null || typeof body === 'string' || body instanceof URLSearchParams) {
      const snapshot = new Request(input instanceof Request ? input.clone() : input, init);
      void snapshot.text().then((bodyText) => {
        rdr.reqHandlerHttp({
          httpMethod: snapshot.method,
          endpoint: snapshot.url,
          bodyText,
        });
      }).catch(() => {});
    }
  } catch {
    // Failure to capture a metric must not prevent the original request.
  }
  return originalFetch(input, init);
};
```

The original fetch Promise, response, and request errors are preserved. Unsupported bodies supplied through `init` are skipped. If `send` uses fetch, exclude the analytics endpoint from this wrapper to avoid collecting its own traffic.

### Cookbook: Manual flush + reset timing on pathname change

```ts
import { history } from './metrics'; // The same instance passed to the router.
import { initRDR, rdr } from 'cosmic-eye';
import { observeHistory } from 'cosmic-eye/extensions';

const observer = observeHistory(history);
let prevPathname: string | null = null;

const ok = initRDR();
if (ok) {
  observer.subscribe(({ action, pathname }) => {
    if (action === 'INIT' || pathname !== prevPathname) {
      prevPathname = pathname;
      rdr.flush(`history action: ${action}`, { pathname });
      rdr.resetTiming();
    }
  });
}
```
