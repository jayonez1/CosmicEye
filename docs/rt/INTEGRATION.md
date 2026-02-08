# Руководство по интеграции — RT (Route Transition Metrics)

## Предварительные требования

- SPA с React Router (v5 или v6)
- npm или совместимый пакетный менеджер
- `react` >= 16.8.0
- `react-router-dom` >= 5.0.0

## Шаг 1: Установка

```bash
npm install cosmic-eye
```

## Шаг 2: Инициализация

```ts
import { initRT, patchHistory } from 'cosmic-eye';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

// Включить модуль RT (работает только в dev)
initRT();

// Патчить history для автоматического отслеживания навигаций
patchHistory(history);
```

`initRT()` безопасно вызывать несколько раз — повторные вызовы ничего не делают.
В production (`NODE_ENV=production`) модуль не активируется.

## Шаг 3: Подключить RouteTracker

```tsx
import { RouteTracker } from 'cosmic-eye/react';
import { rt } from 'cosmic-eye';

<Router history={history}>
  <RouteTracker
    onRouteChange={[
      (pathname) => { rt.markRendered(pathname); },
    ]}
  >
    <Switch>
      <Route path="/home" component={Home} />
    </Switch>
  </RouteTracker>
</Router>
```

`RouteTracker` обнаруживает смену `pathname` и вызывает `markRendered` — это фиксирует момент рендера.

## Шаг 4: Отслеживание критических операций (опционально)

Если страница загружает данные, без которых она не считается интерактивной:

```ts
import { trackCritical } from 'cosmic-eye';

// Вариант 1: с Promise
await trackCritical(fetchData());

// Вариант 2: ручное управление
const done = trackCritical();
await fetchData();
done();
```

TTI не будет зафиксирован, пока все критические операции не завершатся.

## Шаг 5: Комбинация с RDR

Если вы используете и RDR, и RT, RouteTracker может вызывать обе функции:

```tsx
import rdr, { rt } from 'cosmic-eye';
import { RouteTracker } from 'cosmic-eye/react';

<RouteTracker
  onRouteChange={[
    () => { rdr.resetTiming(); rdr.resetActions(); },
    (pathname) => { rt.markRendered(pathname); },
  ]}
>
  {children}
</RouteTracker>
```

## Шаг 6: Очистка (опционально)

```ts
import { rt } from 'cosmic-eye';
rt.destroy();
```

## Примечания

- **Dev-only**: RT работает только при `NODE_ENV !== 'production'`.
- **Куда отправляется**: в v0.2.0 метрики отправляются в `console.log`. Подключаемый транспорт будет добавлен позже.
- **Нормализация**: `/users/123` → `/users/:id` для агрегации метрик.
