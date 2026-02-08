import { ACTIONS } from './config';
import { nowMs } from './utils';
import type { ActionData, ActionSnapshot } from './types';

interface BufferEntry {
  ts: number;
  type: string;
  rum_id: string | null;
}

const _buffer: BufferEntry[] = [];
let _listenersAttached = false;

const _getRumId = (target: EventTarget | null): string | null => {
  try {
    if (!target || typeof (target as HTMLElement).closest !== 'function') {
      return null;
    }

    const el = (target as HTMLElement).closest('[rum-id]');

    return el ? el.getAttribute('rum-id') : null;
  } catch (_) {
    return null;
  }
};

const _reset = (): void => {
  _buffer.length = 0;
};

const _onEvent = (e: Event): void => {
  try {
    if (_buffer.length >= ACTIONS.BUFFER_MAX_SIZE) {
      _reset();
    }

    _buffer.push({
      ts: nowMs(),
      type: e.type,
      rum_id: _getRumId(e.target),
    });
  } catch (_) {
    // nothing
  }
};

export const actions = {
  init(): void {
    if (_listenersAttached) {
      return;
    }

    try {
      for (const eventType of ACTIONS.TRACKED_EVENTS) {
        window.addEventListener(eventType, _onEvent, { capture: true, passive: true });
      }
      _listenersAttached = true;
    } catch (_) {
      // nothing
    }
  },

  reset(): void {
    _reset();
  },

  snapshot(currentTime: number): ActionSnapshot {
    const last = _buffer[_buffer.length - 1] || null;

    if (!last) {
      return {
        lastAction: null,
        timeSinceLastActionMs: null,
      };
    }

    const actionData: ActionData = { type: last.type };

    if (last.rum_id) {
      actionData.rum_id = last.rum_id;
    }

    return {
      lastAction: actionData,
      timeSinceLastActionMs: currentTime - last.ts,
    };
  },

  destroy(): void {
    if (!_listenersAttached) {
      return;
    }

    try {
      for (const eventType of ACTIONS.TRACKED_EVENTS) {
        window.removeEventListener(eventType, _onEvent, { capture: true });
      }
      _listenersAttached = false;
      _reset();
    } catch (_) {
      // nothing
    }
  },
};
