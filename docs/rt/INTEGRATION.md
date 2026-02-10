# Руководство по интеграции — RT (Route Transition Metrics)

## Предварительные требования

- SPA с React Router (v5 или v6)
- npm или совместимый пакетный менеджер
- `react` >= 16.8.0
- `react-router-dom` >= 5.0.0

## Архитектура: pre-render vs post-render

RT измеряет два момента каждого перехода:

1. **Pre-render** — момент начала навигации (`startTransition`). Происходит **до** React-рендера, через `observeHistory`.
2. **Post-render** — момент завершения рендера (`markRendered`). Происходит **после** React commit, через `RouteTracker`.

```
history.push('/page')
  → observeHistory: emit PUSH → rt.startTransition()   ← pre-render
  → React renders <Page />
  → RouteTracker: useLayoutEffect → rt.markRendered()   ← post-render
  → 2×rAF + idle → TTI
```

## Шаг 1: Установка

```bash
npm install cosmic-eye
```

## Шаг 2: Инициализация + observer

```ts
import { initRT, rt, observeHistory } from 'cosmic-eye';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

// Включить модуль RT (работает только в dev)
initRT();

// Подключить observer — pre-render источник навигаций
const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  rt.startTransition(pathname, search);
});
```

- `initRT()` безопасно вызывать несколько раз — повторные вызовы ничего не делают.
- В production (`NODE_ENV=production`) модуль не активируется.
- `observeHistory` идемпотентен — повторный вызов с тем же `history` вернёт тот же observer.

## Шаг 3: Подключить RouteTracker (post-render)

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

`RouteTracker` вызывается **после** React commit (`useLayoutEffect`) — это фиксирует момент рендера.

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

Observer работает как единый pre-render источник для обоих модулей:

```ts
import rdr, { rt, observeHistory } from 'cosmic-eye';

const observer = observeHistory(history);
observer.subscribe(({ pathname, search }) => {
  // Pre-render: RT начинает отсчёт, RDR сбрасывает таймеры
  rt.startTransition(pathname, search);
  rdr.resetTiming();
  rdr.resetActions();
});
```

RouteTracker остаётся только для post-render:

```tsx
<RouteTracker
  onRouteChange={[
    (pathname) => { rt.markRendered(pathname); },
  ]}
>
  {children}
</RouteTracker>
```

## Шаг 6: Очистка (опционально)

```ts
import { rt } from 'cosmic-eye';

observer.unpatch(); // снимает патч с history
rt.destroy();       // очищает RT-состояние
```

## Миграция с v0.2.0

```diff
- import { initRT, patchHistory } from 'cosmic-eye';
- patchHistory(history);
+ import { initRT, rt, observeHistory } from 'cosmic-eye';
+ const observer = observeHistory(history);
+ observer.subscribe(({ pathname, search }) => {
+   rt.startTransition(pathname, search);
+ });
```

## Примечания

- **Dev-only**: RT работает только при `NODE_ENV !== 'production'`.
- **Куда отправляется**: метрики отправляются в `console.log`. Подключаемый транспорт будет добавлен позже.
- **Нормализация**: `/users/123` → `/users/:id` для агрегации метрик.
- **Без RouteTracker**: RT будет таймаутиться через 20 с (ожидаемо — `markRendered` не вызван).
