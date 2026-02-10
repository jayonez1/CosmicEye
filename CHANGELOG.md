# Changelog

## 0.3.0

### Added

- **[extensions]** Новый модуль `history-route-observer` — нейтральный observer навигации через history API.
- **[extensions]** `observeHistory(history)` — возвращает idempotent observer (WeakMap по объекту history).
- **[extensions]** `observer.subscribe(listener)` — подписка на события `INIT`, `PUSH`, `REPLACE`, `POP`.
- **[extensions]** `observer.unpatch()` — снятие патча, восстановление оригинальных методов, очистка.
- **[extensions]** Типы: `NavigationEvent`, `NavigationListener`, `NavigationAction`, `HistoryRouteObserver`, `HistoryLike`, `HistoryLocation`.
- Тесты observer: 21 тест (INIT, PUSH, REPLACE, POP v4/v5, idempotency, unpatch, subscribe/unsubscribe).
- Тесты RDR pre-render reset через observer: 5 тестов.

### Changed

- **[rt] BREAKING**: Удалён `patchHistory` из RT. Используйте `observeHistory` + `observer.subscribe()`.
- **[rt]** Удалены типы `HistoryLike`, `HistoryLocation` из `src/rt/types.ts` — перемещены в observer.
- **[extensions]** `RouteTracker` теперь позиционируется как **post-render** провайдер. Pre-render логика — через `observeHistory`.
- **[docs]** `docs/rt/INTEGRATION.md` — архитектура pre-render/post-render, миграция с v0.2.0.
- **[docs]** `docs/rdr/INTEGRATION.md` — рекомендуемый pre-render reset через observer.
- **[docs]** `src/extensions/route-tracker/README.md` — RouteTracker как post-render only.

### Removed

- **[rt]** `patchHistory` — заменён на `observeHistory` из extensions.
- **[rt]** `parseHistoryArgs` — внутренний helper, перенесён в observer как `parseLocation`.

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
