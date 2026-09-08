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

```ts
import { initRT, rt } from 'cosmic-eye';
import { observeHistory } from 'cosmic-eye/extensions';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

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

`initRT()` returns `boolean`. Subsequent calls return `true` (already initialized).

### Step 3: Connect RouteRenderObserver (post-render)

```tsx
import { RouteRenderObserver } from 'cosmic-eye/react';
import { rt } from 'cosmic-eye';

<RouteRenderObserver
  onRouteChange={[(pathname) => { rt.markRendered(pathname); }]}
>
  {children}
</RouteRenderObserver>
```

### Step 4: Track critical operations (optional)

```ts
import { trackCritical } from 'cosmic-eye';

// Option 1: with Promise
const result = rt.trackCritical(fetchData());
// result: { initialized, tracked }

// Option 2: manual control
const { done } = rt.trackCritical();
await fetchData();
done!();
```

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

---

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `init(config?)` | `boolean` | Initialize with optional config. Returns `true` if active. |
| `isInitialized()` | `boolean` | Check if RT is currently active. |
| `startTransition(pathname, search?)` | `RtStartTransitionResult` | Start tracking a route transition. |
| `markRendered(pathname)` | `RtMarkRenderedResult` | Mark render completion for matching pathname. |
| `trackCritical(promise?)` | `RtTrackCriticalResult` | Track a critical operation. Returns `done` for manual mode. |
| `abortPending(reason?)` | `RtAbortPendingResult` | Abort current transition and send abort event. |
| `destroy()` | `RtDestroyResult` | Clear state and timers. |

All public methods return **result objects** with an `initialized` field.

---

## Configuration — `RtConfig`

All fields are optional. Defaults are applied for omitted fields.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `samplingRate` | `number` | `0.05` | Sampling rate (0..1). |
| `samplingStorageKey` | `string` | `'rum_rt_id'` | localStorage key for client ID. |
| `clientId` | `string` | — | Explicit client ID (overrides localStorage). |
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
