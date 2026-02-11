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
  samplingRate: 0.05,
  send: (payload) => myAnalytics.send('rdr', payload),
  tag: 'my-app-v2',
});
// ok === true if initialized, false if sampling excluded or error
```

`initRDR()` returns `boolean` — `true` if RDR was activated, `false` if not (e.g. sampling excluded). Subsequent calls return `true` (already initialized).

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

All public methods return **result objects** with an `initialized` field. If RDR is not initialized, no work is done and `initialized: false` is returned.

### Step 4: Handle SPA route changes (recommended)

```ts
import { rdr, observeHistory } from 'cosmic-eye';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();
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

All fields are optional. Defaults are applied for omitted fields.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `samplingRate` | `number` | `0.05` | Sampling rate (0..1). |
| `samplingStorageKey` | `string` | `'rum_user_id'` | localStorage key for client ID. |
| `clientId` | `string` | — | Explicit client ID (overrides localStorage). |
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

```ts
import { rdr } from 'cosmic-eye';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = init?.method || 'GET';
  const body = typeof init?.body === 'string' ? init.body : '';

  rdr.reqHandlerHttp({ httpMethod: method, endpoint: url, bodyText: body });

  return originalFetch(input, init);
};
```

### Cookbook: Manual flush + reset timing on pathname change

```ts
import { createBrowserHistory } from 'history';
import { initRDR, rdr, observeHistory } from 'cosmic-eye';

const history = createBrowserHistory();
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
