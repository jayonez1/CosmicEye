# CosmicEye

**RDR (RUM Duplicate Requests)** — lightweight library that detects and logs duplicate API requests in single-page applications.

## What it does

CosmicEye intercepts API request payloads and detects when the same request (identical service, method, params, body) is fired multiple times within a configurable time window (default: 1 000 ms). When a duplicate is detected, a structured log entry is created with timing data, user action context, and environment info.

**Key properties:**

- Params and body are **never stored raw** — only FNV-1a hashes are recorded
- Deterministic sampling: ~5% of production users (always enabled in development)
- Logs are batched and flushed on interval, threshold, or page lifecycle events
- Zero external runtime dependencies

## Installation

```bash
npm install cosmic-eye
```

## Quick start

```ts
import rdr, { initRDR } from 'cosmic-eye';

// 1. Initialize once at app startup
initRDR();

// 2. Feed every API request payload into reqHandler
//    (integrate at the point where your app dispatches requests)
rdr.reqHandler({ s: 'UserService', m: 'getProfile', p: { id: 42 }, b: {} });
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

## What gets logged

Each log entry contains:

| Field | Description |
|-------|-------------|
| `ver` | Library version |
| `endpoint` | `service.method` |
| `reqHash` | `req_{endpointHash}_{paramsHash}_{bodyHash}_{truncationMask}` |
| `deltaMs` | Time between duplicate requests (ms) |
| `timings.timeSincePageLoadMs` | Time since init/reset |
| `timings.timeSinceLastActionMs` | Time since last user action (or `null`) |
| `lastAction` | `{ type, rum_id? }` — last user interaction |
| `env` | `{ visibility, net }` — tab state and connection info |

See [docs/EVENT_SCHEMA.md](docs/EVENT_SCHEMA.md) for the full schema.

## Data safety

- **No PII**: params and body are hashed (FNV-1a), never stored or transmitted raw
- **No cookies/tokens**: only `localStorage` key for sampling client ID
- Truncation flags indicate when data exceeded hash limits

## API

### `initRDR()`

Initialize the RDR instance. Safe to call multiple times (no-op after first init). Must be called before `reqHandler` will process anything.

### `rdr.reqHandler(payload)`

Feed an API request payload. Expected shape: `{ s: string, m: string, p?: unknown, b?: unknown }`.

### `rdr.resetTiming()`

Reset the page-load timer (call on SPA route changes).

### `rdr.resetActions()`

Clear the user actions buffer.

### `rdr.destroy()`

Stop all timers, flush remaining logs, remove event listeners, clean up state.

## Структура проекта

```
src/
  index.ts              — публичный API (только реэкспорты)
  rdr/                  — ядро: детект дубликатов запросов
    index.ts            — RDR-класс, initRDR, экспорты
    config.ts           — константы конфигурации
    hash.ts             — FNV-1a хеширование
    sampling.ts         — детерминированное семплирование
    actions.ts          — отслеживание действий пользователя
    env.ts              — снимок окружения
    utils.ts            — утилиты (time, extension)
    types.ts            — TypeScript-типы
  extensions/           — будущие расширения (пока пусто)
tests/
  rdr/                  — тесты ядра RDR
  extensions/           — тесты расширений
docs/
  checklists/           — чек-листы обновлений и релизов
  best-practices/       — политики: SemVer, тесты, документация
  agent/                — инструкции для AI-агента
```

## Команды тестов

| Команда | Область |
|---------|---------|
| `npm run test` | все тесты |
| `npm run test:rdr` | только RDR |
| `npm run test:extensions` | только extensions |
| `npm run test:watch` | все, watch-режим |

## Конфигурация

Все константы в `src/rdr/config.ts`. См. [docs/CONFIG.md](docs/CONFIG.md).

## Документация

- [EVENT_SCHEMA.md](docs/EVENT_SCHEMA.md) — схема LogEntry
- [CONFIG.md](docs/CONFIG.md) — справочник конфигурации
- [INTEGRATION.md](docs/INTEGRATION.md) — руководство по интеграции
- [CHANGELOG.md](CHANGELOG.md) — история изменений

## License

MIT
