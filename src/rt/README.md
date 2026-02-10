# RT — Route Transition Metrics

Measures SPA route transition timing: render time (`routeRenderMs`) and Time To Interactive (`routeTtiMs`). Dev-only module — does not activate in production.

## Integration

### Prerequisites

- SPA with React Router (v5 or v6)
- npm or compatible package manager
- `react` >= 16.8.0
- `react-router-dom` >= 5.0.0

### Architecture: pre-render vs post-render

RT measures two moments of each transition:

1. **Pre-render** — navigation start (`startTransition`). Happens **before** React render, via `observeHistory`.
2. **Post-render** — render completion (`markRendered`). Happens **after** React commit, via `RouteTracker`.

```
history.push('/page')
  → observeHistory: emit PUSH → rt.startTransition()   ← pre-render
  → React renders <Page />
  → RouteTracker: useLayoutEffect → rt.markRendered()   ← post-render
  → 2×rAF + idle → TTI
```

### Step 1: Install

```bash
npm install cosmic-eye
```

### Step 2: Initialize + observer

```ts
import { initRT, rt, observeHistory } from 'cosmic-eye';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

// Enable RT module (dev only)
initRT();

// Connect observer — pre-render navigation source
const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);
});
```

- `initRT()` is safe to call multiple times — subsequent calls are no-ops.
- In production (`NODE_ENV=production`) the module does not activate.
- `observeHistory` is idempotent — calling again with the same `history` returns the same observer.

### Step 3: Connect RouteTracker (post-render)

```tsx
import { RouteTracker } from 'cosmic-eye/react';
import { rt } from 'cosmic-eye';

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

`RouteTracker` fires **after** React commit (`useLayoutEffect`) — this records the render moment.

### Step 4: Track critical operations (optional)

If a page loads data without which it is not considered interactive:

```ts
import { trackCritical } from 'cosmic-eye';

// Option 1: with Promise
await trackCritical(fetchData());

// Option 2: manual control
const done = trackCritical();
await fetchData();
done();
```

TTI will not be recorded until all critical operations complete.

### Step 5: Combine with RDR

The observer works as a single pre-render source for both modules:

```ts
import rdr, { rt, observeHistory } from 'cosmic-eye';

const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  // Pre-render: RT starts timing, RDR resets timers
  rt.startTransition(pathname, search);
  rdr.resetTiming();
  rdr.resetActions();
});
```

RouteTracker remains only for post-render:

```tsx
<RouteTracker
  onRouteChange={[
    (pathname) => { rt.markRendered(pathname); },
  ]}
>
  {children}
</RouteTracker>
```

### Step 6: Cleanup (optional)

```ts
import { rt } from 'cosmic-eye';

observer.unpatch(); // removes history patch
rt.destroy();       // clears RT state
```

### Migration from v0.2.0

```diff
- import { initRT, patchHistory } from 'cosmic-eye';
- patchHistory(history);
+ import { initRT, rt, observeHistory } from 'cosmic-eye';
+ const observer = observeHistory(history);
+ observer.subscribe(({ pathname, search }) => {
+   rt.startTransition(pathname, search);
+ });
```

### Notes

- **Dev-only**: RT only works when `NODE_ENV !== 'production'`.
- **Flush destination**: metrics are sent to `console.log`. A pluggable transport will be added later.
- **Normalization**: `/users/123` → `/users/:id` for metric aggregation.
- **Without RouteTracker**: RT will time out after 20s (expected — `markRendered` not called).

---

## Configuration Reference

All configuration constants are defined in `src/rt/config.ts`.

### `VERSION`

| Value | Description |
|-------|-------------|
| `'0.1'` | RT log schema version (`MAJOR.MINOR` format). **Not** the package version. |

### `IS_DEV`

| Value | Description |
|-------|-------------|
| `process.env.NODE_ENV !== 'production'` | `true` in development, `false` in production. RT works **only** in dev mode. |

### `CRITICAL_TIMEOUT_MS`

| Value | Description |
|-------|-------------|
| `20_000` | Max TTI wait time (ms). If transition doesn't complete within this time, an entry with `timedOut: true` is sent. |

### `IDLE_TIMEOUT_MS`

| Value | Description |
|-------|-------------|
| `1_500` | Timeout for `requestIdleCallback` (ms). If the browser doesn't become idle within this time, the callback fires forcefully. |

### `RAF_COUNT`

| Value | Description |
|-------|-------------|
| `2` | Number of `requestAnimationFrame` cycles after `markRendered` before checking idle. 2×rAF guarantees paint completion. |

### `EVENT_NAME`

| Value | Description |
|-------|-------------|
| `'cosmic_eye_route_transition'` | Event name used in `console.log` output. |

### `NORMALIZE_ID_REGEX`

| Value | Description |
|-------|-------------|
| `/\/\d+/g` | Regex for replacing numeric URL segments with `:id`. Example: `/users/123` → `/users/:id`. |

---

## Event Schema — RTLogEntry

Each completed route transition creates one `RTLogEntry` object.

### Fields

#### `ver`

Type: `string`

RT log schema version (`MAJOR.MINOR` format). Distinguishes log formats between module versions.

#### `id`

Type: `string`

Unique transition identifier (`crypto.randomUUID()` or fallback).

#### `routeName`

Type: `string`

Normalized path. Numeric segments replaced with `:id`.
Example: `/users/123` → `/users/:id`

#### `pathname`

Type: `string`

Original path without normalization.

#### `routeRenderMs`

Type: `number | null`

Milliseconds from navigation start to React component render completion (`useLayoutEffect`).
`null` if render was not recorded (e.g. timeout without `markRendered`).

#### `routeTtiMs`

Type: `number | null`

Time To Interactive — milliseconds from navigation start to full interactivity.
Includes: render + 2×rAF + browser idle + critical operations completion.
`null` if TTI was not recorded.

#### `search` (optional)

Type: `string`

Query string, if present during navigation. Not included if empty.

#### `timedOut` (optional)

Type: `boolean`

`true` if the transition didn't complete within `CRITICAL_TIMEOUT_MS` (20s) and was forcefully finalized.

### Example

```json
{
  "ver": "0.1",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "routeName": "/users/:id",
  "pathname": "/users/123",
  "routeRenderMs": 45,
  "routeTtiMs": 120,
  "search": "?tab=settings"
}
```

### Timeout example

```json
{
  "ver": "0.1",
  "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "routeName": "/reports/:id",
  "pathname": "/reports/42",
  "routeRenderMs": null,
  "routeTtiMs": 20000,
  "timedOut": true
}
```
