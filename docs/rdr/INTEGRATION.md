# Руководство по интеграции

## Предварительные требования

- JavaScript/TypeScript SPA с централизованным слоем API-запросов
- npm или совместимый пакетный менеджер

## Шаг 1: Установка

```bash
npm install cosmic-eye
```

## Шаг 2: Инициализация при запуске приложения

Вызовите `initRDR()` как можно раньше — до отправки любых API-запросов.

```ts
// src/index.ts (или точка входа вашего приложения)
import { initRDR } from 'cosmic-eye';

initRDR();
```

`initRDR()` безопасно вызывать несколько раз — последующие вызовы ничего не делают. Если текущий пользователь не входит в группу семплирования (production), инициализация тихо пропускается.

## Шаг 3: Передавайте API-запросы в `reqHandler`

Найдите место в приложении, где отправляются API-запросы (например, service layer, обёртка fetch или middleware), и передавайте payload каждого запроса в `rdr.reqHandler()`.

```ts
import rdr from 'cosmic-eye';

// Пример: внутри service/fetch-обёртки
function callApi(service: string, method: string, params: unknown, body: unknown) {
  const payload = { s: service, m: method, p: params, b: body };

  // Передайте в RDR до (или после) отправки фактического запроса
  rdr.reqHandler(payload);

  // ... ваша фактическая логика API-вызова
}
```

### Формат payload

| Поле | Тип | Обязательно | Описание |
|-------|------|----------|-------------|
| `s` | `string` | Да | Название сервиса |
| `m` | `string` | Да | Название метода |
| `p` | `unknown` | Нет | Параметры запроса (будут хешироваться, не сохраняться) |
| `b` | `unknown` | Нет | Тело запроса (будет хешироваться, не сохраняться) |

Если `s` или `m` отсутствует/ложное, вызов ничего не делает.

## Шаг 4: Обрабатывайте смену маршрутов SPA (рекомендуется)

Если ваше SPA переходит между маршрутами без полной перезагрузки страницы, вызывайте `resetTiming()` при смене маршрута, чтобы получать корректные значения `timeSincePageLoadMs`.

### Рекомендуемый способ: pre-render reset через observer

`observeHistory` эмитит события навигации **до** React-рендера — это даёт наиболее точный момент сброса:

```ts
import rdr, { observeHistory } from 'cosmic-eye';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

const observer = observeHistory(history);
observer.subscribe(() => {
  rdr.resetTiming();
  rdr.resetActions();
});
```

`observeHistory` идемпотентен — если вы уже подключили observer для RT, используйте тот же:

```ts
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);   // RT pre-render
  rdr.resetTiming();                      // RDR pre-render reset
  rdr.resetActions();
});
```

### Альтернатива: через роутер

```ts
import rdr from 'cosmic-eye';

router.afterEach(() => {
  rdr.resetTiming();
  rdr.resetActions();
});
```

> **Примечание**: `RouteTracker` (`cosmic-eye/react`) — это **post-render** компонент. Для RDR reset рекомендуется pre-render подход через `observeHistory`, а не RouteTracker.

## Шаг 5: Очистка (опционально)

Если ваше приложение поддерживает hot-module replacement или требуется teardown:

```ts
import rdr from 'cosmic-eye';

rdr.destroy();
```

Это останавливает таймеры, выполняет flush оставшихся логов, удаляет обработчики событий и очищает внутреннее состояние.

## Примечания

- **Семплирование**: в production активны только ~5% пользователей. В development (`NODE_ENV !== 'production'`) активны все пользователи.
- **Безопасность данных**: параметры и тело никогда не сохраняются — только их FNV-1a хеши.
- **Куда отправляется flush**: в v0.1.0 обнаруженные дубликаты отправляются в `console.log`. Подключаемый транспорт будет добавлен в будущей версии.
