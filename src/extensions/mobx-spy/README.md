# mobxSpy — MobX Spy Extension

Lightweight MobX spy integration for CosmicEye. Tracks MobX actions and reactions in a buffer, providing snapshots suitable for use as enrichers.

`mobxSpy` does not import `mobx` automatically. Pass `spy` explicitly via `init({ spy })`.

## Quick Start

```ts
import { spy } from 'mobx';
import { mobxSpy } from 'cosmic-eye/extensions';
import { initRDR } from 'cosmic-eye';

// Required for tracking: pass spy explicitly
mobxSpy.init({ spy });

initRDR({
  enrichers: [
    { name: 'mobx', get: (nowMs) => mobxSpy.snapshot(nowMs) },
  ],
});
```

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `init(config?)` | `void` | Start listening to MobX spy events when `spy` is provided. No-op if `spy` is missing or already initialized. |
| `reset()` | `void` | Clear action and reaction buffers. |
| `snapshot(currentTime?)` | `MobxSpySnapshot` | Get last action/reaction with time-since values. |
| `destroy()` | `void` | Stop listening, clear buffers. |

## Configuration — `MobxSpyConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `spy` | `(listener) => () => void` | — | `mobx.spy` function from app code. Required for actual tracking. |
| `bufferMaxSize` | `number` | `5` | Max entries per buffer before reset. |
| `trackedTypes` | `string[]` | `['action', 'reaction']` | MobX event types to track. |

## Snapshot Format — `MobxSpySnapshot`

```ts
{
  lastAction: {
    name: string | null;
    storeName: string | null;
    timeSinceMs: number;
  } | null;
  lastReaction: {
    name: string | null;
    timeSinceMs: number;
  } | null;
}
```

## Requirements

- Install `mobx` in your app only if you use this extension and provide `spy` in config.

## Types

- `MobxSpySnapshot` — snapshot return type
- `MobxSpyConfig` — configuration options
- `MobxActionEntry` — action snapshot entry
- `MobxReactionEntry` — reaction snapshot entry
