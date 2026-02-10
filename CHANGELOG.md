# Changelog

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
