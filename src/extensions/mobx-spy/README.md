# mobxSpy — MobX Spy Extension

Lightweight MobX spy integration for CosmicEye. Tracks MobX actions and reactions in a buffer, providing snapshots suitable for use as enrichers.

If MobX is not installed, all methods are safe no-ops — no errors, no side effects.

## Quick Start

```ts
import { mobxSpy } from 'cosmic-eye';

// Initialize — dynamically imports mobx, no-op if absent
mobxSpy.init();

// Use as enricher in RDR or RT
import { initRDR } from 'cosmic-eye';

initRDR({
  enrichers: [
    { name: 'mobx', get: (nowMs) => mobxSpy.snapshot(nowMs) },
  ],
});
```

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `init(config?)` | `void` | Start listening to MobX spy events. No-op if mobx absent or already initialized. |
| `reset()` | `void` | Clear action and reaction buffers. |
| `snapshot(currentTime?)` | `MobxSpySnapshot` | Get last action/reaction with time-since values. |
| `destroy()` | `void` | Stop listening, clear buffers. |

## Configuration — `MobxSpyConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
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

- `mobx` — optional peer dependency. If not installed, all methods are no-ops.

## Types

- `MobxSpySnapshot` — snapshot return type
- `MobxSpyConfig` — configuration options
- `MobxActionEntry` — action snapshot entry
- `MobxReactionEntry` — reaction snapshot entry
