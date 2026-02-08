# Схема события — RTLogEntry

Каждый завершённый переход между маршрутами создаёт один объект `RTLogEntry`.

## Поля

### `ver`

Тип: `string`

Версия схемы логов RT (формат `MAJOR.MINOR`). Позволяет различать форматы между версиями модуля.

### `id`

Тип: `string`

Уникальный идентификатор перехода (`crypto.randomUUID()` или fallback).

### `routeName`

Тип: `string`

Нормализованный путь. Числовые сегменты заменены на `:id`.
Пример: `/users/123` → `/users/:id`

### `pathname`

Тип: `string`

Оригинальный путь без нормализации.

### `routeRenderMs`

Тип: `number | null`

Миллисекунды от начала навигации до завершения рендера React-компонента (`useLayoutEffect`).
`null` если рендер не был зафиксирован (например, при таймауте без `markRendered`).

### `routeTtiMs`

Тип: `number | null`

Time To Interactive — миллисекунды от начала навигации до полной интерактивности.
Включает: рендер + 2×rAF + browser idle + завершение критических операций.
`null` если TTI не был зафиксирован.

### `search` (опционально)

Тип: `string`

Query string, если присутствовал при навигации. Не включается, если пустой.

### `timedOut` (опционально)

Тип: `boolean`

`true` если переход не завершился за `CRITICAL_TIMEOUT_MS` (20 с) и был принудительно завершён.

## Пример

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

## Пример с таймаутом

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
