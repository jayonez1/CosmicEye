# Схема события — LogEntry

Каждый обнаруженный дублирующийся запрос создаёт один объект `LogEntry`, который добавляется в очередь flush.

## Поля

### `ver`

Тип: `string`

Версия схемы логов RDR (формат `MAJOR.MINOR`). Позволяет различать форматы логов между версиями модуля. **Не** версия пакета.

### `endpoint`

Тип: `string`

Формат: `{service}.{method}`. Идентифицирует API-эндпоинт дублирующегося запроса.

### `reqHash`

Тип: `string`

Формат: `req_{endpointHash}_{paramsHash}_{bodyHash}_{truncationMask}`

Полный составной хеш, однозначно идентифицирующий запрос. Строится из:
- `endpointHash` — FNV-1a от `service.method`
- `paramsHash` — структурный хеш `params`
- `bodyHash` — структурный хеш `body`
- `truncationMask` — битовая маска: `1` = params обрезаны, `2` = body обрезан

### `deltaMs`

Тип: `number`

Миллисекунды между текущим запросом и предыдущим идентичным запросом (тот же `reqHash`). Показывает частоту дубликатов.

### `timings`

Объект с временным контекстом.

#### `timings.timeSincePageLoadMs`

Тип: `number`

Миллисекунды с момента вызова `init()` (или с последнего `resetTiming()`). Полезно для понимания, когда в рамках сессии возникают дубликаты.

#### `timings.timeSinceLastActionMs`

Тип: `number | null`

Миллисекунды с момента последнего отслеженного действия пользователя (`click`, `keydown`, `touchstart`). `null`, если действий ещё не было.

### `lastAction`

Тип: `{ type: string; rum_id?: string } | null`

Самое последнее взаимодействие пользователя до обнаружения дубликата.

| Поле | Тип | Описание |
|-------|------|-------------|
| `type` | `string` | Тип события: `click`, `keydown`, `touchstart` |
| `rum_id` | `string` (опционально) | Значение атрибута `rum-id` у ближайшего родительского элемента |

`null`, если действия пользователя не отслеживались.

### `env`

Тип: `{ visibility: string; net: { effectiveType: string | null } | null }`

Снимок окружения на момент обнаружения.

| Поле | Тип | Описание |
|-------|------|-------------|
| `visibility` | `string` | Видимость вкладки: `visible`, `hidden` или `unknown` |
| `net.effectiveType` | `string \| null` | Тип соединения: `4g`, `3g`, `2g`, `slow-2g` или `null` |

### `mobx` (только dev, опционально)

Тип: `unknown`

Заполнитель для данных MobX spy. Заполняется только в dev-интеграциях, которые предоставляют hook MobX spy. Не является частью ядра библиотеки — потребляющее приложение может прикреплять эти данные извне.

## Пример

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
