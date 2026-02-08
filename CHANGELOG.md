# Changelog

## 0.2.0

### Added

- **[rt]** Новый модуль RT (Route Transition Metrics) — измерение времени переходов между маршрутами в SPA.
- **[rt]** `initRT()`, `patchHistory(history)`, `trackCritical(promise?)` — публичный API модуля RT.
- **[rt]** Поддержка history v4 и v5 в `patchHistory`.
- **[extensions]** `RouteTracker` — «глупый» React-компонент для отслеживания смены маршрутов. Вызывает массив колбэков `onRouteChange` при смене `pathname`.
- **[extensions]** Отдельная точка входа `cosmic-eye/react` для React-расширений (не требует React для основного импорта).
- Именованные экспорты `rdr` и `rt` из корневого модуля.
- `RDR_VERSION` и `RT_VERSION` экспорты (версии схем логов).
- npm-скрипты: `test:rt`, `test:watch:rt`.
- Документация: `docs/rdr/`, `docs/rt/`, `docs/extensions/`.

### Changed

- **[rdr]** `VERSION` изменён на формат `MAJOR.MINOR` (`'0.1'`). Это версия схемы логов, **не** версия пакета.
- **[rdr]** Удалён экспорт `VERSION` — заменён на `RDR_VERSION`.
- Документация каждого модуля перенесена в отдельные директории: `docs/rdr/`, `docs/rt/`.
- `package.json`: версия пакета `0.2.0`, добавлены `peerDependencies` (react, react-dom, react-router-dom — optional).
- `tsup.config.ts`: два entry point (`index.ts`, `react.ts`).
- `tsconfig.json`: добавлена поддержка JSX (`react-jsx`).

### Fixed

- **[rt]** Исправлен баг falsy-zero: `renderedAt` и `interactiveAt` корректно обрабатываются при значении `0` (использование `!== null` вместо truthy-проверки).

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
