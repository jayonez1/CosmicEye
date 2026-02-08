import { makeRequestKey } from './hash';
import { VERSION, TIMINGS, FLUSH, IS_DEV } from './config';
import { actions } from './actions';
import { env } from './env';
import { nowMs, elapsedMs, sendToExtension } from './utils';
import { shouldEnableSample } from './sampling';
import type { ApiRequestPayload, LogEntry, RequestKeyResult } from './types';

class RDR {
  private _requestsMap = new Map<string, number>();
  private _logQueue: LogEntry[] = [];
  private _cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private _flushTimer: ReturnType<typeof setInterval> | null = null;
  private _initialized = false;
  private _pageLoadTime: number | null = null;
  private _boundOnVisibilityChange: (() => void) | null = null;
  private _boundOnPageHide: (() => void) | null = null;

  init(): void {
    if (this._initialized) {
      return;
    }

    try {
      if (!shouldEnableSample()) {
        return;
      }

      this._initialized = true;
      this._pageLoadTime = nowMs();
      actions.init();
      this._startCleanupInterval();
      this._startFlushInterval();
      this._attachLifecycleListeners();
    } catch (_) {
      // nothing
    }
  }

  reqHandler(payload: ApiRequestPayload): void {
    if (!this._initialized) {
      return;
    }

    try {
      if (!payload?.s || !payload?.m) {
        return;
      }

      const reqData = this._genReqHash(payload);

      if (!reqData) {
        return;
      }

      const currentTime = nowMs();
      const lastRequestTime = this._requestsMap.get(reqData.reqHash);

      if (lastRequestTime !== undefined) {
        const timeDiff = elapsedMs(lastRequestTime);

        if (timeDiff < TIMINGS.DUPLICATE_THRESHOLD_MS) {
          this._addToLogQueue(reqData, currentTime, timeDiff);
        }
      }

      this._requestsMap.set(reqData.reqHash, currentTime);
    } catch (_) {
      // nothing
    }
  }

  resetTiming(): void {
    this._pageLoadTime = nowMs();
  }

  resetActions(): void {
    actions.reset();
  }

  destroy(): void {
    try {
      if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer);
        this._cleanupTimer = null;
      }

      if (this._flushTimer) {
        clearInterval(this._flushTimer);
        this._flushTimer = null;
      }

      this._detachLifecycleListeners();
      this._flush('destroy');
      actions.destroy();
      this._requestsMap.clear();
      this._logQueue = [];
      this._initialized = false;
    } catch (_) {
      // nothing
    }
  }

  private _genReqHash(payload: ApiRequestPayload): RequestKeyResult | null {
    try {
      return makeRequestKey(payload);
    } catch (_) {
      return null;
    }
  }

  private _addToLogQueue(reqData: RequestKeyResult, currentTime: number, timeDiff: number): void {
    try {
      const actionsSnapshot = actions.snapshot(currentTime);
      const envSnapshot = env.snapshot();

      const logEntry: LogEntry = {
        ver: VERSION,
        endpoint: reqData.endpoint,
        reqHash: reqData.reqHash,
        deltaMs: timeDiff,
        timings: {
          timeSincePageLoadMs: elapsedMs(this._pageLoadTime!),
          timeSinceLastActionMs: actionsSnapshot.timeSinceLastActionMs,
        },
        lastAction: actionsSnapshot.lastAction,
        env: envSnapshot,
      };

      this._logQueue.push(logEntry);

      if (IS_DEV) {
        sendToExtension(logEntry);
      }

      if (this._logQueue.length >= FLUSH.MAX_EVENTS) {
        this._flush('threshold');
      }
    } catch (_) {
      // nothing
    }
  }

  private _startCleanupInterval(): void {
    if (this._cleanupTimer) {
      return;
    }

    this._cleanupTimer = setInterval(() => {
      this._cleanupOldRequests();
    }, TIMINGS.CLEANUP_INTERVAL_MS);
  }

  private _cleanupOldRequests(): void {
    try {
      const currentTime = nowMs();
      const threshold = currentTime - TIMINGS.DUPLICATE_THRESHOLD_MS;

      for (const [hash, timestamp] of this._requestsMap) {
        if (timestamp < threshold) {
          this._requestsMap.delete(hash);
        }
      }
    } catch (_) {
      // nothing
    }
  }

  private _startFlushInterval(): void {
    if (this._flushTimer) {
      return;
    }

    this._flushTimer = setInterval(() => {
      this._flush('interval');
    }, FLUSH.INTERVAL_MS);
  }

  private _attachLifecycleListeners(): void {
    try {
      this._boundOnVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          this._flush('visibilitychange');
        }
      };

      this._boundOnPageHide = () => {
        this._flush('pagehide');
      };

      document.addEventListener('visibilitychange', this._boundOnVisibilityChange);
      window.addEventListener('pagehide', this._boundOnPageHide);
    } catch (_) {
      // nothing
    }
  }

  private _detachLifecycleListeners(): void {
    try {
      if (this._boundOnVisibilityChange) {
        document.removeEventListener('visibilitychange', this._boundOnVisibilityChange);
        this._boundOnVisibilityChange = null;
      }

      if (this._boundOnPageHide) {
        window.removeEventListener('pagehide', this._boundOnPageHide);
        this._boundOnPageHide = null;
      }
    } catch (_) {
      // nothing
    }
  }

  private _flush(trigger: string): void {
    try {
      if (this._logQueue.length === 0) {
        return;
      }

      const logsToSend = this._logQueue.slice();

      this._logQueue = [];

      // eslint-disable-next-line no-console
      console.log(`[RDR] Flush (${trigger}):`, logsToSend);
    } catch (_) {
      // nothing
    }
  }
}

const rdr = new RDR();

export const initRDR = (): void => {
  rdr.init();
};

export default rdr;

export type {
  ApiRequestPayload,
  LogEntry,
  RequestKeyResult,
  StructuredHashResult,
  HashLimitsConfig,
  ActionData,
  ActionSnapshot,
  EnvSnapshot,
} from './types';

export { hashText, makeRequestKey } from './hash';
export { VERSION } from './config';
