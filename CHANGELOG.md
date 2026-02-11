# Changelog

## 0.5.0

### Added

- **[shared]** New `src/shared/` layer with extracted common utilities: time, env, sampling, hash, generate-id, enrichers, chrome-ext.
- **[rdr]** `init(config?)` now accepts optional `RdrConfig` and returns `boolean`.
- **[rdr]** `isInitialized()` public method.
- **[rdr]** All public methods return typed result objects with `initialized` field.
- **[rdr]** `flush(trigger?, meta?)` public manual flush with trigger name and metadata.
- **[rdr]** `reqHandlerRpc(payload)` for RPC-style requests.
- **[rdr]** `reqHandlerHttp(payload)` for HTTP-style requests (`httpMethod`, `endpoint`, `bodyText`).
- **[rdr]** Configurable `send` function for custom transport. Falls back to `console.log`.
- **[rdr]** `enrichers` config option: sync getters called during payload formation with error handling.
- **[rdr]** `tag` config option: custom metric tag added to every log entry.
- **[rdr]** `chromeExtensionEvents` config option: dispatches `CustomEvent('rdr', ...)`.
- **[rdr]** `rpcKeyFactory` / `httpKeyFactory` config options for custom request key factories.
- **[rdr]** Config-driven `hashLimits`, `actionsBufferMaxSize`, `actionsTrackedEvents`.
- **[rt]** `init(config?)` now accepts optional `RtConfig` and returns `boolean`.
- **[rt]** `isInitialized()` public method.
- **[rt]** All public methods return typed result objects with `initialized` field.
- **[rt]** `abortPending(reason?)` to abort active transition and send abort event.
- **[rt]** `includePathname` / `includeSearch` config options (default: `false`).
- **[rt]** Configurable `send` function for custom transport. Falls back to `console.log`.
- **[rt]** `enrichers`, `tag`, `chromeExtensionEvents` config options (same as RDR).
- **[extensions]** New `mobxSpy` extension: MobX spy integration with buffered actions/reactions. No-op if MobX absent.
- **[extensions]** `mobxSpy.init(config?)`, `mobxSpy.reset()`, `mobxSpy.snapshot(nowMs?)`, `mobxSpy.destroy()`.
- **[shared]** `makeHttpRequestKey(payload)` for HTTP request fingerprinting.
- **[shared]** `collectEnrichers(enrichers, limits)` with truncation and error resilience.
- **[shared]** `dispatchExtensionEvent(name, type, data)` for Chrome extension integration.
- New types: `RdrConfig`, `RtConfig`, `RdrFlushPayload`, `RdrSendFn`, `RtSendFn`, `RtEventPayload`, `Enricher`, `EnricherLimitsConfig`, `MobxSpySnapshot`, `MobxSpyConfig`, and all result types.

### Changed

- **[rdr] BREAKING**: `initRDR()` now returns `boolean` (was `void`).
- **[rdr] BREAKING**: `reqHandler` is now a deprecated alias for `reqHandlerRpc`.
- **[rdr] BREAKING**: `destroy()`, `resetTiming()`, `resetActions()` now return result objects (were `void`).
- **[rdr]** `RTLogEntry.pathname` is now optional (only included when `includePathname: true`).
- **[rt] BREAKING**: `initRT()` now returns `boolean` (was `void`).
- **[rt] BREAKING**: `startTransition()`, `markRendered()`, `trackCritical()`, `destroy()` now return result objects.
- **[rt] BREAKING**: `trackCritical()` returns `RtTrackCriticalResult` object with `done` property (was `(() => void) | undefined`).
- **[rt]** `pathname` and `search` are no longer included in RT payload by default.
- **[shared]** Sampling is now fully config-driven via `samplingRate`, `samplingStorageKey`, `clientId`.

### Removed

- **[rdr]** `IS_DEV` check. Behavior is now fully config-driven.
- **[rt]** `IS_DEV` check. Behavior is now fully config-driven.
- **[rdr]** `_resetSamplingState()` export (sampling is now stateless per-call).
- **[rdr]** `SAMPLING`, `TIMINGS`, `FLUSH`, `ACTIONS`, `CHROME_EXT` config groups replaced by flat `DEFAULTS` object.

### Migration

```diff
- import { initRDR } from 'cosmic-eye';
- initRDR();
+ const ok = initRDR({ samplingRate: 0.05 });

- rdr.reqHandler(payload);
+ rdr.reqHandlerRpc(payload);

- rdr.destroy();
+ const { destroyed } = rdr.destroy();

- import { initRT } from 'cosmic-eye';
- initRT();
+ const ok = initRT({ send: myTransport, includePathname: true });

- const done = rt.trackCritical();
+ const { done } = rt.trackCritical();

- import { makeRequestKey } from 'cosmic-eye';
+ import { makeRpcRequestKey } from 'cosmic-eye';
```

## 0.4.0

### Added

- **[extensions]** `RouteRenderObserver` — renamed from `RouteTracker`, same behavior.
- Observer tests: 4 new no-duplicate regression tests.

### Changed

- **[extensions] BREAKING**: `RouteTracker` renamed to `RouteRenderObserver`. Directory `route-tracker` → `route-render-observer`. Type `RouteTrackerProps` → `RouteRenderObserverProps`.
- **[root] BREAKING**: Removed default export of `rdr`. Use `import { rdr } from 'cosmic-eye'` instead of `import rdr from 'cosmic-eye'`.
- **[root] BREAKING**: Removed `RDR_VERSION` and `RT_VERSION` exports.
- **[extensions]** Fixed duplicate navigation events in `history-route-observer` — `listen` callback now only emits `POP`; `PUSH`/`REPLACE` come exclusively from patched methods.
- **[docs]** All extension READMEs are now self-contained — no cross-module references.
- **[docs]** RDR README: removed RT mentions, removed "Alternative: via router" section, removed Prerequisites block.
- **[docs]** RT README: removed RDR cross-references, removed "Combine with RDR" section.

### Removed

- **[root]** Default export (`export { default } from './rdr'`).
- **[root]** `RDR_VERSION` and `RT_VERSION` exports.
- **[extensions]** `_placeholder` directory.
- **[extensions]** `RouteTracker` name (replaced by `RouteRenderObserver`).
- **[extensions]** `RouteTrackerProps` type (replaced by `RouteRenderObserverProps`).

### Migration

```diff
- import rdr from 'cosmic-eye';
+ import { rdr } from 'cosmic-eye';

- import { RDR_VERSION, RT_VERSION } from 'cosmic-eye';
  // RDR_VERSION and RT_VERSION are no longer exported

- import { RouteTracker } from 'cosmic-eye/react';
+ import { RouteRenderObserver } from 'cosmic-eye/react';

- <RouteTracker onRouteChange={[...]}>{children}</RouteTracker>
+ <RouteRenderObserver onRouteChange={[...]}>{children}</RouteRenderObserver>

- import type { RouteTrackerProps } from 'cosmic-eye/react';
+ import type { RouteRenderObserverProps } from 'cosmic-eye/react';
```

## 0.3.0

### Added

- **[extensions]** New `history-route-observer` module — neutral navigation observer via history API.
- **[extensions]** `observeHistory(history)` — returns an idempotent observer (WeakMap keyed by history object).
- **[extensions]** `observer.subscribe(listener)` — subscribe to `INIT`, `PUSH`, `REPLACE`, `POP` events.
- **[extensions]** `observer.unpatch()` — removes patch, restores original methods, cleans up.
- **[extensions]** Types: `NavigationEvent`, `NavigationListener`, `NavigationAction`, `HistoryRouteObserver`, `HistoryLike`, `HistoryLocation`.
- Observer tests: 21 tests (INIT, PUSH, REPLACE, POP v4/v5, idempotency, unpatch, subscribe/unsubscribe).
- RDR pre-render reset via observer tests: 5 tests.

### Changed

- **[rt] BREAKING**: Removed `patchHistory` from RT. Use `observeHistory` + `observer.subscribe()`.
- **[rt]** Removed types `HistoryLike`, `HistoryLocation` from `src/rt/types.ts` — moved to observer.
- **[extensions]** `RouteTracker` is now positioned as a **post-render** provider. Pre-render logic uses `observeHistory`.
- **[docs]** RT integration guide — pre-render/post-render architecture, migration from v0.2.0.
- **[docs]** RDR integration guide — recommended pre-render reset via observer.
- **[docs]** RouteTracker README — post-render only positioning.

### Removed

- **[rt]** `patchHistory` — replaced by `observeHistory` from extensions.
- **[rt]** `parseHistoryArgs` — internal helper, moved to observer as `parseLocation`.

### Migration

```diff
- import { initRT, patchHistory } from 'cosmic-eye';
- patchHistory(history);
+ import { initRT, rt, observeHistory } from 'cosmic-eye';
+ const observer = observeHistory(history);
+ observer.subscribe(({ pathname, search }) => {
+   rt.startTransition(pathname, search);
+ });
```

## 0.2.0

### Added

- **[rt]** New RT module (Route Transition Metrics) — SPA route transition timing.
- **[rt]** `initRT()`, `patchHistory(history)`, `trackCritical(promise?)` — RT public API.
- **[rt]** Support for history v4 and v5 in `patchHistory`.
- **[extensions]** `RouteTracker` — "dumb" React component for route change tracking. Calls `onRouteChange` callbacks on `pathname` change.
- **[extensions]** Separate entry point `cosmic-eye/react` for React extensions (no React required for main import).
- Named exports `rdr` and `rt` from root module.
- `RDR_VERSION` and `RT_VERSION` exports (log schema versions).
- npm scripts: `test:rt`, `test:watch:rt`.
- Documentation: per-module docs directories.

### Changed

- **[rdr]** `VERSION` changed to `MAJOR.MINOR` format (`'0.1'`). This is the log schema version, **not** the package version.
- **[rdr]** Removed `VERSION` export — replaced with `RDR_VERSION`.
- Per-module documentation moved to separate directories.
- `package.json`: package version `0.2.0`, added `peerDependencies` (react, react-dom, react-router-dom — optional).
- `tsup.config.ts`: two entry points (`index.ts`, `react.ts`).
- `tsconfig.json`: added JSX support (`react-jsx`).

### Fixed

- **[rt]** Fixed falsy-zero bug: `renderedAt` and `interactiveAt` correctly handled when value is `0` (using `!== null` instead of truthy check).

## 0.1.0

Initial release.

### Features

- Duplicate API request detection based on FNV-1a hashing of endpoint + params + body
- Configurable time window for duplicate detection (default: 1 000 ms)
- Deterministic user sampling (~5% in production, always enabled in development)
- User action tracking (`click`, `keydown`, `touchstart`) with `rum-id` attribute support
- Environment snapshot (tab visibility, network effective type)
- Batch flush with multiple triggers: interval, threshold, visibilitychange, pagehide, destroy
- Structured hashing with depth/node/key/array/string limits and truncation flags
- Full TypeScript types for all public interfaces

### Differences from reference implementation

- **Removed**: `mobxSpy` module — MobX is an optional peer concern, not bundled. The `logEntry.mobx` field is typed as `unknown` and can be populated externally
- **Removed**: `window.RDR = this` assignment — consumers should use the exported `rdr` instance directly
- **Added**: `_resetSamplingState()` export from `sampling.ts` for test isolation
- **Changed**: `VERSION` now reads `'0.1.0'` (was `'1.0.0'` in reference)
- **Changed**: `removeEventListener` for actions uses `{ capture: true }` without `passive` (matches browser API for removal)
