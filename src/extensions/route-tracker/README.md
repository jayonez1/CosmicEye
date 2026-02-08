# RouteTracker

React-компонент для отслеживания смены маршрутов в SPA.

## Назначение

`RouteTracker` — «глупый» провайдер. Он **не знает** о RDR, RT или других модулях.
Его единственная задача: обнаружить смену `pathname` через `useLocation()` и вызвать зарегистрированные колбэки.

## API

```tsx
import { RouteTracker } from 'cosmic-eye/react';

<RouteTracker onRouteChange={[callback1, callback2]}>
  {children}
</RouteTracker>
```

### Props

| Prop | Тип | Описание |
|------|-----|----------|
| `children` | `ReactNode` | Дочерние элементы (обычно `<Switch>` / `<Routes>`) |
| `onRouteChange` | `Array<(pathname, search) => void>` | Колбэки, вызываемые при смене маршрута |

### Поведение

- Колбэки вызываются из `useLayoutEffect` — **после** commit фазы React.
- Вызываются при **каждой** смене `pathname`, включая первый рендер.
- Изменения `search` при том же `pathname` **не** вызывают колбэки (передаются как аргумент).
- Каждый колбэк обёрнут в `try/catch` — ошибка в одном не блокирует остальные.
- Используется `ref` для колбэков — изменение массива не вызывает лишних перерендеров.

## Пример интеграции

```tsx
import rdr, { rt } from 'cosmic-eye';
import { RouteTracker } from 'cosmic-eye/react';

<Router history={history}>
  <RouteTracker
    onRouteChange={[
      () => { rdr.resetTiming(); rdr.resetActions(); },
      (pathname) => { rt.markRendered(pathname); },
    ]}
  >
    <Switch>
      <Route path="/home" component={Home} />
    </Switch>
  </RouteTracker>
</Router>
```

## Требования

- `react` >= 16.8.0 (хуки)
- `react-router-dom` >= 5.0.0 (`useLocation`)
