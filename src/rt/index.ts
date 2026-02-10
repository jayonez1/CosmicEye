import { VERSION, IS_DEV, CRITICAL_TIMEOUT_MS, IDLE_TIMEOUT_MS, RAF_COUNT, EVENT_NAME } from './config';
import { nowMs, normalizeRoute, afterFrames, whenIdle, generateId } from './utils';
import type { Transition, RTLogEntry } from './types';

class RT {
  private _currentTransition: Transition | null = null;
  private _criticalTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _initialized = false;

  init(): void {
    if (this._initialized || !IS_DEV) {
      return;
    }

    this._initialized = true;
  }

  startTransition(pathname: string, search = ''): void {
    if (!this._initialized) {
      return;
    }

    try {
      if (this._currentTransition && !this._currentTransition.sent) {
        this._currentTransition.aborted = true;
      }

      if (this._criticalTimeoutId) {
        clearTimeout(this._criticalTimeoutId);
        this._criticalTimeoutId = null;
      }

      this._currentTransition = {
        id: generateId(),
        startAt: nowMs(),
        renderedAt: null,
        interactiveAt: null,
        pathname,
        search,
        routeName: normalizeRoute(pathname),
        pendingCritical: 0,
        aborted: false,
        timedOut: false,
        sent: false,
      };

      this._criticalTimeoutId = setTimeout(() => {
        const t = this._currentTransition;

        if (t && !t.sent && !t.aborted) {
          t.timedOut = true;
          t.interactiveAt = nowMs();
          this._finishTransition(t);
        }
      }, CRITICAL_TIMEOUT_MS);
    } catch (_) {
      // nothing
    }
  }

  markRendered(pathname: string): void {
    if (!this._initialized) {
      return;
    }

    try {
      const t = this._currentTransition;

      if (!t || t.sent || t.aborted) {
        return;
      }

      if (t.pathname !== pathname || t.renderedAt !== null) {
        return;
      }

      t.renderedAt = nowMs();
      this._checkInteractive();
    } catch (_) {
      // nothing
    }
  }

  trackCritical(promise?: Promise<unknown>): (() => void) | undefined {
    if (!this._initialized || !this._currentTransition) {
      return typeof promise === 'undefined' ? () => {} : undefined;
    }

    const t = this._currentTransition;

    t.pendingCritical++;

    const done = (): void => {
      if (t.pendingCritical > 0) {
        t.pendingCritical--;
      }

      if (t === this._currentTransition) {
        this._checkInteractive();
      }
    };

    if (promise && typeof promise.finally === 'function') {
      promise.finally(done);
      return undefined;
    }

    return done;
  }

  destroy(): void {
    try {
      if (this._criticalTimeoutId) {
        clearTimeout(this._criticalTimeoutId);
        this._criticalTimeoutId = null;
      }

      this._currentTransition = null;
      this._initialized = false;
    } catch (_) {
      // nothing
    }
  }

  private _checkInteractive(): void {
    const t = this._currentTransition;

    if (!t || t.sent || t.aborted || t.renderedAt === null || t.pendingCritical > 0) {
      return;
    }

    afterFrames(() => {
      if (!this._currentTransition || this._currentTransition !== t || t.sent || t.aborted) {
        return;
      }

      whenIdle(() => {
        if (!this._currentTransition || this._currentTransition !== t || t.sent || t.aborted) {
          return;
        }

        if (t.pendingCritical > 0) {
          return;
        }

        t.interactiveAt = nowMs();
        this._finishTransition(t);
      }, IDLE_TIMEOUT_MS);
    }, RAF_COUNT);
  }

  private _finishTransition(transition: Transition): void {
    if (transition.sent || transition.aborted) {
      return;
    }

    transition.sent = true;

    if (this._criticalTimeoutId) {
      clearTimeout(this._criticalTimeoutId);
      this._criticalTimeoutId = null;
    }

    const payload: RTLogEntry = {
      ver: VERSION,
      id: transition.id,
      routeName: transition.routeName,
      pathname: transition.pathname,
      routeRenderMs: transition.renderedAt !== null
        ? Math.round(transition.renderedAt - transition.startAt)
        : null,
      routeTtiMs: transition.interactiveAt !== null
        ? Math.round(transition.interactiveAt - transition.startAt)
        : null,
    };

    if (transition.search) {
      payload.search = transition.search;
    }

    if (transition.timedOut) {
      payload.timedOut = true;
    }

    this._sendEvent(payload);
  }

  private _sendEvent(payload: RTLogEntry): void {
    try {
      // eslint-disable-next-line no-console
      console.log(`[RT] ${EVENT_NAME}:`, payload);
    } catch (_) {
      // nothing
    }
  }
}

const rt = new RT();

export const initRT = (): void => {
  rt.init();
};

/** Convenience wrapper for rt.trackCritical(). */
export const trackCritical = (promise?: Promise<unknown>): (() => void) | undefined => {
  return rt.trackCritical(promise);
};

export default rt;

export { VERSION } from './config';

export type {
  Transition,
  RTLogEntry,
} from './types';
