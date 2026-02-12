import { nowMs } from '../../shared/time';
import type { MobxSpySnapshot, MobxSpyConfig } from './types';

const DEFAULTS = {
  BUFFER_MAX_SIZE: 5,
  TRACKED_TYPES: ['action', 'reaction'] as readonly string[],
} as const;

interface BufferAction {
  ts: number;
  name: string | null;
  storeName: string | null;
}

interface BufferReaction {
  ts: number;
  name: string | null;
}

const _actionsBuffer: BufferAction[] = [];
const _reactionsBuffer: BufferReaction[] = [];
let _disposer: (() => void) | null = null;
let _bufferMaxSize: number = DEFAULTS.BUFFER_MAX_SIZE;
let _trackedTypes: readonly string[] = DEFAULTS.TRACKED_TYPES;

const _getStoreName = (object: unknown): string | null => {
  if (!object) {
    return null;
  }

  try {
    const obj = object as { constructor?: { name?: string }; name?: string };
    return obj.constructor?.name || obj.name || null;
  } catch (_) {
    return null;
  }
};

const _onSpyEvent = (event: { type: string; name?: string; object?: unknown }): void => {
  try {
    const type = event.type;

    if (!_trackedTypes.includes(type)) {
      return;
    }

    if (type === 'action') {
      if (_actionsBuffer.length >= _bufferMaxSize) {
        _actionsBuffer.length = 0;
      }

      _actionsBuffer.push({
        ts: nowMs(),
        name: event.name || null,
        storeName: _getStoreName(event.object),
      });
    }

    if (type === 'reaction') {
      if (_reactionsBuffer.length >= _bufferMaxSize) {
        _reactionsBuffer.length = 0;
      }

      _reactionsBuffer.push({
        ts: nowMs(),
        name: event.name || null,
      });
    }
  } catch (_) {
    // nothing
  }
};

/**
 * MobX spy extension.
 *
 * DI-only integration: pass `mobx.spy` via `init({ spy })`.
 * If `spy` is not provided, `init()` is a safe no-op.
 * Designed to be used as a presend enricher via `mobxSpy.snapshot()`.
 */
export const mobxSpy = {
  init(config?: MobxSpyConfig): void {
    if (_disposer) {
      return;
    }

    _bufferMaxSize = config?.bufferMaxSize ?? DEFAULTS.BUFFER_MAX_SIZE;
    _trackedTypes = config?.trackedTypes ?? DEFAULTS.TRACKED_TYPES;

    if (typeof config?.spy !== 'function') {
      return;
    }

    try {
      _disposer = config.spy(_onSpyEvent as (event: unknown) => void);
    } catch (_) {
      // spy attach failed — no-op
    }
  },

  reset(): void {
    _actionsBuffer.length = 0;
    _reactionsBuffer.length = 0;
  },

  snapshot(currentTime?: number): MobxSpySnapshot {
    const now = currentTime ?? nowMs();
    const lastAction = _actionsBuffer[_actionsBuffer.length - 1] || null;
    const lastReaction = _reactionsBuffer[_reactionsBuffer.length - 1] || null;

    const result: MobxSpySnapshot = {
      lastAction: null,
      lastReaction: null,
    };

    if (lastAction) {
      result.lastAction = {
        name: lastAction.name,
        storeName: lastAction.storeName,
        timeSinceMs: now - lastAction.ts,
      };
    }

    if (lastReaction) {
      result.lastReaction = {
        name: lastReaction.name,
        timeSinceMs: now - lastReaction.ts,
      };
    }

    return result;
  },

  destroy(): void {
    if (_disposer) {
      try {
        _disposer();
      } catch (_) {
        // nothing
      }
      _disposer = null;
    }

    _actionsBuffer.length = 0;
    _reactionsBuffer.length = 0;
  },
};

export type { MobxSpySnapshot, MobxSpyConfig, MobxActionEntry, MobxReactionEntry } from './types';
