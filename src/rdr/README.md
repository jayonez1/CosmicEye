# RDR — RUM Duplicate Requests

Detects and logs duplicate API requests in SPAs. Uses FNV-1a hashing of endpoint + params + body to identify duplicates within a configurable time window.

## Integration

### Step 1: Install

```bash
npm install cosmic-eye
```

### Step 2: Initialize at application startup

Call `initRDR()` as early as possible — before any API requests are sent.

```ts
import { initRDR } from 'cosmic-eye';

initRDR();
```

`initRDR()` is safe to call multiple times — subsequent calls are no-ops. If the current user is not in the sampling group (production), initialization is silently skipped.

### Step 3: Pass API requests to `reqHandler`

Find the place in your application where API requests are sent (e.g. service layer, fetch wrapper, or middleware), and pass each request payload to `rdr.reqHandler()`.

```ts
import { rdr } from 'cosmic-eye';

function callApi(service: string, method: string, params: unknown, body: unknown) {
  const payload = { s: service, m: method, p: params, b: body };

  rdr.reqHandler(payload);

  // ... your actual API call logic
}
```

#### Payload format

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `s` | `string` | Yes | Service name |
| `m` | `string` | Yes | Method name |
| `p` | `unknown` | No | Request params (hashed, never stored) |
| `b` | `unknown` | No | Request body (hashed, never stored) |

If `s` or `m` is missing/falsy, the call is a no-op.

### Step 4: Handle SPA route changes (recommended)

If your SPA navigates between routes without a full page reload, call `resetTiming()` on route change to get accurate `timeSincePageLoadMs` values.

#### Recommended: pre-render reset via observer

`observeHistory` emits navigation events **before** React render — this gives the most accurate reset moment:

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

`observeHistory` is idempotent — calling again with the same `history` returns the same observer. If you need to reset actions on route change, add `rdr.resetActions()` to the subscriber.

### Step 5: Cleanup (optional)

If your application supports hot-module replacement or requires teardown:

```ts
import { rdr } from 'cosmic-eye';

rdr.destroy();
```

This stops timers, flushes remaining logs, removes event listeners, and clears internal state.

### Notes

- **Sampling**: in production only ~5% of users are active. In development (`NODE_ENV !== 'production'`) all users are active.
- **Data safety**: params and body are never stored — only their FNV-1a hashes.
- **Flush destination**: detected duplicates are sent to `console.log`. A pluggable transport will be added in a future version.

---

## Configuration Reference

All configuration constants are defined in `src/rdr/config.ts`. These are compile-time constants — to change them, modify the source and rebuild.

### `VERSION`

| Value | Description |
|-------|-------------|
| `'0.1'` | RDR log schema version (`MAJOR.MINOR` format). **Not** the package version — this is the `LogEntry` format version. |

### `IS_DEV`

| Value | Description |
|-------|-------------|
| `process.env.NODE_ENV !== 'production'` | `true` in development, `false` in production builds |

Controls: sampling bypass (always enabled in dev), Chrome extension data dispatch.

### `SAMPLING`

| Key | Value | Description |
|-----|-------|-------------|
| `RATE` | `0.05` | Fraction of production users sampled (5%) |
| `STORAGE_KEY` | `'rum_user_id'` | `localStorage` key for persistent client ID |

Sampling is deterministic: client ID is FNV-1a hashed and mapped to a bucket `[0, 1)`. If `bucket < RATE`, the user is sampled.

### `TIMINGS`

| Key | Value | Description |
|-----|-------|-------------|
| `DUPLICATE_THRESHOLD_MS` | `1_000` | Max time window (ms) between requests to consider them duplicates |
| `CLEANUP_INTERVAL_MS` | `10_000` | Interval (ms) for cleaning expired entries from the request map |

### `FLUSH`

| Key | Value | Description |
|-----|-------|-------------|
| `INTERVAL_MS` | `15_000` | Periodic flush interval (ms) |
| `MAX_EVENTS` | `50` | Max log entries before triggering immediate flush |

### `HASH_LIMITS`

| Key | Value | Description |
|-----|-------|-------------|
| `MAX_DEPTH` | `20` | Max object nesting depth during hashing |
| `MAX_NODES` | `5_000` | Max total visited nodes (values) during hashing |
| `MAX_OBJECT_KEYS` | `300` | Max object keys to hash |
| `MAX_ARRAY_ITEMS` | `1_000` | Max array items to hash |
| `MAX_STRING_CHARS` | `2_048` | Max string length for hashing (truncated beyond) |

When any limit is exceeded, the hash is still computed but `wasTruncated` is set to `true`, reflected in the `truncationMask` of `reqHash`.

### `ACTIONS`

| Key | Value | Description |
|-----|-------|-------------|
| `BUFFER_MAX_SIZE` | `3` | Max user action events in buffer before reset |
| `TRACKED_EVENTS` | `['click', 'keydown', 'touchstart']` | DOM events tracked for `lastAction` context |

### `CHROME_EXT`

| Key | Value | Description |
|-----|-------|-------------|
| `EVENT_NAME` | `'__RDR_LOG__'` | `CustomEvent` name for sending log data to Chrome DevTools extension (dev only) |

---

## Event Schema — LogEntry

Each detected duplicate request creates one `LogEntry` object added to the flush queue.

### Fields

#### `ver`

Type: `string`

RDR log schema version (`MAJOR.MINOR` format). Distinguishes log formats between module versions. **Not** the package version.

#### `endpoint`

Type: `string`

Format: `{service}.{method}`. Identifies the API endpoint of the duplicate request.

#### `reqHash`

Type: `string`

Format: `req_{endpointHash}_{paramsHash}_{bodyHash}_{truncationMask}`

Full composite hash uniquely identifying the request. Built from:
- `endpointHash` — FNV-1a of `service.method`
- `paramsHash` — structural hash of `params`
- `bodyHash` — structural hash of `body`
- `truncationMask` — bitmask: `1` = params truncated, `2` = body truncated

#### `deltaMs`

Type: `number`

Milliseconds between the current request and the previous identical request (same `reqHash`). Shows duplicate frequency.

#### `timings`

Object with temporal context.

##### `timings.timeSincePageLoadMs`

Type: `number`

Milliseconds since `init()` was called (or since last `resetTiming()`). Useful for understanding when during a session duplicates occur.

##### `timings.timeSinceLastActionMs`

Type: `number | null`

Milliseconds since the last tracked user action (`click`, `keydown`, `touchstart`). `null` if no actions have occurred yet.

#### `lastAction`

Type: `{ type: string; rum_id?: string } | null`

Most recent user interaction before duplicate detection.

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | Event type: `click`, `keydown`, `touchstart` |
| `rum_id` | `string` (optional) | Value of `rum-id` attribute on nearest parent element |

`null` if no user actions have been tracked.

#### `env`

Type: `{ visibility: string; net: { effectiveType: string | null } | null }`

Environment snapshot at the moment of detection.

| Field | Type | Description |
|-------|------|-------------|
| `visibility` | `string` | Tab visibility: `visible`, `hidden`, or `unknown` |
| `net.effectiveType` | `string \| null` | Connection type: `4g`, `3g`, `2g`, `slow-2g`, or `null` |

#### `mobx` (dev only, optional)

Type: `unknown`

Placeholder for MobX spy data. Only populated in dev integrations that provide a MobX spy hook. Not part of the core library — the consuming application can attach this data externally.

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
    "net": {
      "effectiveType": "4g"
    }
  }
}
```
