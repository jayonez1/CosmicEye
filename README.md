# CosmicEye

Набор RUM-метрик для SPA. Два независимых модуля:

- **RDR** (RUM Duplicate Requests) — детект и логирование дублирующихся API-запросов.
- **RT** (Route Transition Metrics) — измерение времени переходов между маршрутами (render + TTI).

**Ключевые свойства:**

- Нуль runtime-зависимостей для ядра (React — optional peer для расширений)
- RDR: детерминированный семплинг ~5% в production, всегда включен в dev
- RT: dev-only, измеряет `route_render_ms` и `route_tti_ms`
- `RouteTracker` — «глупый» React-провайдер для обоих модулей

## Installation

```bash
npm install cosmic-eye
```

## Quick start

### RDR

```ts
import rdr, { initRDR } from 'cosmic-eye';

initRDR();
rdr.reqHandler({ s: 'UserService', m: 'getProfile', p: { id: 42 }, b: {} });
```

### RT + RouteTracker

```ts
import { initRT, patchHistory, rt } from 'cosmic-eye';
import { RouteTracker } from 'cosmic-eye/react';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();
initRT();
patchHistory(history);
```

```tsx
<Router history={history}>
  <RouteTracker
    onRouteChange={[
      () => { rdr.resetTiming(); rdr.resetActions(); },
      (pathname) => { rt.markRendered(pathname); },
    ]}
  >
    <Switch>...</Switch>
  </RouteTracker>
</Router>
```

## How duplicate detection works

1. Each incoming payload is hashed into a `reqHash` (combining endpoint + params hash + body hash)
2. If the same `reqHash` was seen within `TIMINGS.DUPLICATE_THRESHOLD_MS` (default 1 000 ms), a log entry is created
3. Log entries accumulate in a buffer and are flushed:
   - Every `FLUSH.INTERVAL_MS` (15 s)
   - When buffer reaches `FLUSH.MAX_EVENTS` (50)
   - On `visibilitychange` (tab hidden)
   - On `pagehide` (page close)
   - On `destroy()`

## Sampling

In **production** (`NODE_ENV=production`), only ~5% of users are sampled. The decision is deterministic and stable across page reloads — a client ID is persisted in `localStorage` under key `rum_user_id`, hashed, and checked against the sampling rate.

In **development** (`NODE_ENV !== 'production'`), sampling is always enabled.

## API

### RDR

| Функция | Описание |
|---------|----------|
| `initRDR()` | Инициализация. Безопасно вызывать многократно. |
| `rdr.reqHandler(payload)` | Передать API-запрос. `{ s, m, p?, b? }` |
| `rdr.resetTiming()` | Сброс таймера (SPA route change) |
| `rdr.resetActions()` | Очистка буфера действий |
| `rdr.destroy()` | Остановить таймеры, flush, очистить |

### RT

| Функция | Описание |
|---------|----------|
| `initRT()` | Включить модуль (dev-only) |
| `patchHistory(history)` | Патч history для авто-отслеживания навигаций |
| `rt.markRendered(pathname)` | Отметить рендер маршрута |
| `trackCritical(promise?)` | Отслеживать критическую async-операцию |
| `rt.destroy()` | Очистка |

### RouteTracker (`cosmic-eye/react`)

| Prop | Тип | Описание |
|------|-----|----------|
| `children` | `ReactNode` | Дочерние элементы |
| `onRouteChange` | `Array<(pathname, search) => void>` | Колбэки на смену маршрута |

See [docs/rdr/EVENT_SCHEMA.md](docs/rdr/EVENT_SCHEMA.md) and [docs/rt/EVENT_SCHEMA.md](docs/rt/EVENT_SCHEMA.md) for log schemas.

## Структура проекта

```
src/
  index.ts              — публичный API (только реэкспорты, без React)
  react.ts              — точка входа React-расширений (cosmic-eye/react)
  rdr/                  — модуль RDR: детект дубликатов запросов
  rt/                   — модуль RT: метрики переходов между маршрутами
  extensions/
    route-tracker/      — RouteTracker React-компонент
tests/
  rdr/                  — тесты RDR (49)
  rt/                   — тесты RT (19)
  extensions/           — тесты расширений (6)
docs/
  rdr/                  — CONFIG, EVENT_SCHEMA, INTEGRATION для RDR
  rt/                   — CONFIG, EVENT_SCHEMA, INTEGRATION для RT
  checklists/           — чек-листы обновлений и релизов
  best-practices/       — политики: SemVer, тесты, документация
  agent/                — инструкции для AI-агента

## Команды тестов

| Команда | Область |
|---------|--------|
| `npm run test` | все тесты |
| `npm run test:rdr` | только RDR |
| `npm run test:rt` | только RT |
| `npm run test:extensions` | только extensions |
| `npm run test:watch` | все, watch-режим |

## Документация

### RDR
- [docs/rdr/CONFIG.md](docs/rdr/CONFIG.md) — справочник конфигурации
- [docs/rdr/EVENT_SCHEMA.md](docs/rdr/EVENT_SCHEMA.md) — схема LogEntry
- [docs/rdr/INTEGRATION.md](docs/rdr/INTEGRATION.md) — руководство по интеграции

### RT
- [docs/rt/CONFIG.md](docs/rt/CONFIG.md) — справочник конфигурации
- [docs/rt/EVENT_SCHEMA.md](docs/rt/EVENT_SCHEMA.md) — схема RTLogEntry
- [docs/rt/INTEGRATION.md](docs/rt/INTEGRATION.md) — руководство по интеграции

### Общее
- [CHANGELOG.md](CHANGELOG.md) — история изменений

## License

MIT
