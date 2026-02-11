import { shouldEnableSample } from '../shared/sampling';
import { collectEnrichers, DEFAULT_ENRICHER_LIMITS } from '../shared/enrichers';
import { dispatchExtensionEvent } from '../shared/chrome-ext';
import { VERSION, DEFAULTS, EVENT_NAME, CHROME_EXT_EVENT_NAME } from './config';
import { nowMs, normalizeRoute, afterFrames, whenIdle, generateId } from './utils';
import type {
  Transition,
  RTLogEntry,
  RtEventPayload,
  RtConfig,
  RtSendFn,
  RtStartTransitionResult,
  RtMarkRenderedResult,
  RtTrackCriticalResult,
  RtAbortPendingResult,
  RtDestroyResult,
} from './types';
import type { EnricherLimitsConfig } from '../shared/types';

class RT {
  private _currentTransition: Transition | null = null;
  private _criticalTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _initialized = false;

  // Config-derived fields (set during init)
  private _criticalTimeoutMs: number = DEFAULTS.CRITICAL_TIMEOUT_MS;
  private _idleTimeoutMs: number = DEFAULTS.IDLE_TIMEOUT_MS;
  private _rafCount: number = DEFAULTS.RAF_COUNT;
  private _includePathname = false;
  private _includeSearch = false;
  private _sendFn: RtSendFn | null = null;
  private _enrichers: RtConfig['enrichers'] = undefined;
  private _enricherLimits: EnricherLimitsConfig = DEFAULT_ENRICHER_LIMITS;
  private _tag: string | undefined = undefined;
  private _chromeExtensionEvents = false;

  init(config?: RtConfig): boolean {
    if (this._initialized) {
      return true;
    }

    try {
      // Apply config BEFORE setting _initialized
      this._applyConfig(config);

      const sampled = shouldEnableSample({
        rate: config?.samplingRate ?? DEFAULTS.SAMPLING_RATE,
        storageKey: config?.samplingStorageKey ?? DEFAULTS.SAMPLING_STORAGE_KEY,
        clientId: config?.clientId ?? null,
      });

      if (!sampled) {
        return false;
      }

      this._initialized = true;

      return true;
    } catch (_) {
      return false;
    }
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  startTransition(pathname: string, search = ''): RtStartTransitionResult {
    if (!this._initialized) {
      return { initialized: false, started: false };
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
      }, this._criticalTimeoutMs);

      return { initialized: true, started: true };
    } catch (_) {
      return { initialized: true, started: false };
    }
  }

  markRendered(pathname: string): RtMarkRenderedResult {
    if (!this._initialized) {
      return { initialized: false, marked: false };
    }

    try {
      const t = this._currentTransition;

      if (!t || t.sent || t.aborted) {
        return { initialized: true, marked: false };
      }

      if (t.pathname !== pathname || t.renderedAt !== null) {
        return { initialized: true, marked: false };
      }

      t.renderedAt = nowMs();
      this._checkInteractive();

      return { initialized: true, marked: true };
    } catch (_) {
      return { initialized: true, marked: false };
    }
  }

  trackCritical(promise?: Promise<unknown>): RtTrackCriticalResult {
    if (!this._initialized || !this._currentTransition) {
      const noopDone = typeof promise === 'undefined' ? () => {} : undefined;

      return { initialized: this._initialized, tracked: false, done: noopDone };
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

      return { initialized: true, tracked: true };
    }

    return { initialized: true, tracked: true, done };
  }

  abortPending(reason?: string): RtAbortPendingResult {
    if (!this._initialized) {
      return { initialized: false, aborted: false };
    }

    try {
      const t = this._currentTransition;

      if (!t || t.sent || t.aborted) {
        return { initialized: true, aborted: false };
      }

      t.aborted = true;

      if (this._criticalTimeoutId) {
        clearTimeout(this._criticalTimeoutId);
        this._criticalTimeoutId = null;
      }

      // Send an abort event so the consumer knows
      const payload = this._buildPayload(t);
      payload.aborted = true;

      if (reason) {
        payload.abortReason = reason;
      }

      this._sendEventPayload({ type: 'abort', entry: payload });

      this._currentTransition = null;

      return { initialized: true, aborted: true };
    } catch (_) {
      return { initialized: true, aborted: false };
    }
  }

  destroy(): RtDestroyResult {
    if (!this._initialized) {
      return { initialized: false, destroyed: false };
    }

    try {
      if (this._criticalTimeoutId) {
        clearTimeout(this._criticalTimeoutId);
        this._criticalTimeoutId = null;
      }

      this._currentTransition = null;
      this._initialized = false;

      return { initialized: false, destroyed: true };
    } catch (_) {
      return { initialized: this._initialized, destroyed: false };
    }
  }

  // ─── Private ───

  private _applyConfig(config?: RtConfig): void {
    if (!config) {
      return;
    }

    if (config.criticalTimeoutMs !== undefined) {
      this._criticalTimeoutMs = config.criticalTimeoutMs;
    }
    if (config.idleTimeoutMs !== undefined) {
      this._idleTimeoutMs = config.idleTimeoutMs;
    }
    if (config.rafCount !== undefined) {
      this._rafCount = config.rafCount;
    }
    if (config.includePathname !== undefined) {
      this._includePathname = config.includePathname;
    }
    if (config.includeSearch !== undefined) {
      this._includeSearch = config.includeSearch;
    }
    if (config.send) {
      this._sendFn = config.send;
    }
    if (config.enrichers) {
      this._enrichers = config.enrichers;
    }
    if (config.enricherLimits) {
      this._enricherLimits = { ...DEFAULT_ENRICHER_LIMITS, ...config.enricherLimits };
    }
    if (config.tag !== undefined) {
      this._tag = config.tag || undefined;
    }
    if (config.chromeExtensionEvents !== undefined) {
      this._chromeExtensionEvents = config.chromeExtensionEvents;
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
      }, this._idleTimeoutMs);
    }, this._rafCount);
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

    const payload = this._buildPayload(transition);

    if (transition.timedOut) {
      payload.timedOut = true;
    }

    this._sendEventPayload({ type: 'transition', entry: payload });
  }

  private _buildPayload(transition: Transition): RTLogEntry {
    const enrichments = collectEnrichers(this._enrichers, this._enricherLimits);

    const payload: RTLogEntry = {
      ver: VERSION,
      id: transition.id,
      routeName: transition.routeName,
      routeRenderMs: transition.renderedAt !== null
        ? Math.round(transition.renderedAt - transition.startAt)
        : null,
      routeTtiMs: transition.interactiveAt !== null
        ? Math.round(transition.interactiveAt - transition.startAt)
        : null,
    };

    if (this._includePathname) {
      payload.pathname = transition.pathname;
    }

    if (this._includeSearch && transition.search) {
      payload.search = transition.search;
    }

    if (this._tag) {
      payload.tag = this._tag;
    }

    if (enrichments) {
      payload.enrichments = enrichments;
    }

    return payload;
  }

  private _sendEventPayload(eventPayload: RtEventPayload): void {
    try {
      if (this._sendFn) {
        try {
          this._sendFn(eventPayload);
        } catch (_) {
          // nothing
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(`CosmicEye: RT | ${eventPayload.type} | ${EVENT_NAME}`, eventPayload);
      }

      if (this._chromeExtensionEvents) {
        dispatchExtensionEvent(CHROME_EXT_EVENT_NAME, eventPayload.type, eventPayload);
      }
    } catch (_) {
      // nothing
    }
  }
}

const rt = new RT();

export const initRT = (config?: RtConfig): boolean => {
  return rt.init(config);
};

/** Convenience wrapper for rt.trackCritical(). */
export const trackCritical = (promise?: Promise<unknown>): RtTrackCriticalResult => {
  return rt.trackCritical(promise);
};

export default rt;

export { VERSION } from './config';

export type {
  Transition,
  RTLogEntry,
  RtEventPayload,
  RtSendFn,
  RtConfig,
  RtStartTransitionResult,
  RtMarkRenderedResult,
  RtTrackCriticalResult,
  RtAbortPendingResult,
  RtDestroyResult,
  Enricher,
  EnricherLimitsConfig,
} from './types';
