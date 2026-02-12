import { makeRpcRequestKey, makeHttpRequestKey, DEFAULT_HASH_LIMITS } from '../shared/hash';
import { nowMs, elapsedMs } from '../shared/time';
import { env } from '../shared/env';
import { shouldEnableSample } from '../shared/sampling';
import { collectEnrichers, DEFAULT_ENRICHER_LIMITS } from '../shared/enrichers';
import { dispatchExtensionEvent } from '../shared/chrome-ext';
import { VERSION, DEFAULTS, CHROME_EXT_EVENT_NAME } from './config';
import { actions } from './actions';
import type {
  RpcRequestPayload,
  HttpRequestPayload,
  RdrLogEntry,
  RdrFlushPayload,
  RdrConfig,
  RdrSendFn,
  RdrKeyFactory,
  RdrFlushResult,
  RdrReqHandlerResult,
  RdrResetTimingResult,
  RdrResetActionsResult,
  RdrDestroyResult,
} from './types';
import type { HashLimitsConfig, RequestKeyResult, EnricherLimitsConfig } from '../shared/types';

class RDR {
  private _requestsMap = new Map<string, number>();
  private _logQueue: RdrLogEntry[] = [];
  private _cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private _flushTimer: ReturnType<typeof setInterval> | null = null;
  private _initialized = false;
  private _pageLoadTime: number | null = null;
  private _boundOnVisibilityChange: (() => void) | null = null;
  private _boundOnPageHide: (() => void) | null = null;

  // Config-derived fields (set during init)
  private _duplicateThresholdMs: number = DEFAULTS.DUPLICATE_THRESHOLD_MS;
  private _cleanupIntervalMs: number = DEFAULTS.CLEANUP_INTERVAL_MS;
  private _flushIntervalMs: number = DEFAULTS.FLUSH_INTERVAL_MS;
  private _flushMaxEvents: number = DEFAULTS.FLUSH_MAX_EVENTS;
  private _hashLimits: HashLimitsConfig = DEFAULT_HASH_LIMITS;
  private _sendFn: RdrSendFn | null = null;
  private _rpcKeyFactory: RdrKeyFactory | null = null;
  private _httpKeyFactory: RdrKeyFactory | null = null;
  private _enrichers: RdrConfig['enrichers'] = undefined;
  private _enricherLimits: EnricherLimitsConfig = DEFAULT_ENRICHER_LIMITS;
  private _tag: string | undefined = undefined;
  private _chromeExtensionEvents = false;

  init(config?: RdrConfig): boolean {
    if (this._initialized) {
      return true;
    }

    try {
      // Apply and validate config BEFORE setting _initialized
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
      this._pageLoadTime = nowMs();
      actions.init(config?.actionsBufferMaxSize, config?.actionsTrackedEvents);
      this._startCleanupInterval();
      this._startFlushInterval();
      this._attachLifecycleListeners();

      return true;
    } catch (_) {
      return false;
    }
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  reqHandlerRpc(payload: RpcRequestPayload): RdrReqHandlerResult {
    if (!this._initialized) {
      return { initialized: false, processed: false, duplicate: false };
    }

    try {
      if (!payload?.s || !payload?.m) {
        return { initialized: true, processed: false, duplicate: false };
      }

      let reqData: RequestKeyResult | null;

      if (this._rpcKeyFactory) {
        try {
          reqData = this._rpcKeyFactory(payload);
        } catch (_) {
          reqData = null;
        }
      } else {
        reqData = this._genRpcHash(payload);
      }

      if (!reqData) {
        return { initialized: true, processed: false, duplicate: false };
      }

      return this._processRequest(reqData);
    } catch (_) {
      return { initialized: true, processed: false, duplicate: false };
    }
  }

  reqHandlerHttp(payload: HttpRequestPayload): RdrReqHandlerResult {
    if (!this._initialized) {
      return { initialized: false, processed: false, duplicate: false };
    }

    try {
      if (!payload?.httpMethod || !payload?.endpoint) {
        return { initialized: true, processed: false, duplicate: false };
      }

      let reqData: RequestKeyResult | null;

      if (this._httpKeyFactory) {
        try {
          reqData = this._httpKeyFactory(payload);
        } catch (_) {
          reqData = null;
        }
      } else {
        reqData = this._genHttpHash(payload);
      }

      if (!reqData) {
        return { initialized: true, processed: false, duplicate: false };
      }

      return this._processRequest(reqData);
    } catch (_) {
      return { initialized: true, processed: false, duplicate: false };
    }
  }

  flush(trigger = 'manual', meta?: unknown): RdrFlushResult {
    if (!this._initialized) {
      return { initialized: false, flushed: false, entriesCount: 0 };
    }

    return this._flush(trigger, meta);
  }

  resetTiming(): RdrResetTimingResult {
    if (!this._initialized) {
      return { initialized: false, reset: false };
    }

    this._pageLoadTime = nowMs();

    return { initialized: true, reset: true };
  }

  resetActions(): RdrResetActionsResult {
    if (!this._initialized) {
      return { initialized: false, reset: false };
    }

    actions.reset();

    return { initialized: true, reset: true };
  }

  destroy(): RdrDestroyResult {
    if (!this._initialized) {
      return { initialized: false, destroyed: false };
    }

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

      return { initialized: false, destroyed: true };
    } catch (_) {
      return { initialized: this._initialized, destroyed: false };
    }
  }

  // ─── Private ───

  private _applyConfig(config?: RdrConfig): void {
    if (!config) {
      return;
    }

    if (config.duplicateThresholdMs !== undefined) {
      this._duplicateThresholdMs = config.duplicateThresholdMs;
    }
    if (config.cleanupIntervalMs !== undefined) {
      this._cleanupIntervalMs = config.cleanupIntervalMs;
    }
    if (config.flushIntervalMs !== undefined) {
      this._flushIntervalMs = config.flushIntervalMs;
    }
    if (config.flushMaxEvents !== undefined) {
      this._flushMaxEvents = config.flushMaxEvents;
    }
    if (config.hashLimits) {
      this._hashLimits = { ...DEFAULT_HASH_LIMITS, ...config.hashLimits };
    }
    if (config.send) {
      this._sendFn = config.send;
    }
    if (config.rpcKeyFactory) {
      this._rpcKeyFactory = config.rpcKeyFactory;
    }
    if (config.httpKeyFactory) {
      this._httpKeyFactory = config.httpKeyFactory;
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

  private _processRequest(reqData: RequestKeyResult): RdrReqHandlerResult {
    const currentTime = nowMs();
    const lastRequestTime = this._requestsMap.get(reqData.reqHash);
    let isDuplicate = false;

    if (lastRequestTime !== undefined) {
      const timeDiff = elapsedMs(lastRequestTime);

      if (timeDiff < this._duplicateThresholdMs) {
        this._addToLogQueue(reqData, currentTime, timeDiff);
        isDuplicate = true;
      }
    }

    this._requestsMap.set(reqData.reqHash, currentTime);

    return { initialized: true, processed: true, duplicate: isDuplicate };
  }

  private _genRpcHash(payload: RpcRequestPayload): RequestKeyResult | null {
    try {
      return makeRpcRequestKey(payload, this._hashLimits);
    } catch (_) {
      return null;
    }
  }

  private _genHttpHash(payload: HttpRequestPayload): RequestKeyResult | null {
    try {
      return makeHttpRequestKey(payload, this._hashLimits);
    } catch (_) {
      return null;
    }
  }

  private _addToLogQueue(reqData: RequestKeyResult, currentTime: number, timeDiff: number): void {
    try {
      const actionsSnapshot = actions.snapshot(currentTime);
      const envSnapshot = env.snapshot();
      const enrichments = collectEnrichers(this._enrichers, this._enricherLimits);

      const logEntry: RdrLogEntry = {
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

      if (this._tag) {
        logEntry.tag = this._tag;
      }

      if (enrichments) {
        logEntry.enrichments = enrichments;
      }

      this._logQueue.push(logEntry);

      if (this._chromeExtensionEvents) {
        dispatchExtensionEvent(CHROME_EXT_EVENT_NAME, 'log', logEntry);
      }

      if (this._logQueue.length >= this._flushMaxEvents) {
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
    }, this._cleanupIntervalMs);
  }

  private _cleanupOldRequests(): void {
    try {
      const currentTime = nowMs();
      const threshold = currentTime - this._duplicateThresholdMs;

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
    }, this._flushIntervalMs);
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

  private _flush(trigger: string, meta?: unknown): RdrFlushResult {
    try {
      if (this._logQueue.length === 0) {
        return { initialized: this._initialized, flushed: false, entriesCount: 0 };
      }

      const entries = this._logQueue.slice();
      const count = entries.length;

      this._logQueue = [];

      const flushPayload: RdrFlushPayload = { trigger, entries };

      if (meta !== undefined) {
        flushPayload.meta = meta;
      }

      if (this._sendFn) {
        try {
          this._sendFn(flushPayload);
        } catch (_) {
          // nothing
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(`CosmicEye: RDR | flush | ${trigger}`, flushPayload);
      }

      if (this._chromeExtensionEvents) {
        dispatchExtensionEvent(CHROME_EXT_EVENT_NAME, 'flush', flushPayload);
      }

      return { initialized: this._initialized, flushed: true, entriesCount: count };
    } catch (_) {
      return { initialized: this._initialized, flushed: false, entriesCount: 0 };
    }
  }
}

const rdr = new RDR();

export const initRDR = (config?: RdrConfig): boolean => {
  return rdr.init(config);
};

export default rdr;

export type {
  RpcRequestPayload,
  HttpRequestPayload,
  RdrLogEntry,
  RdrFlushPayload,
  RdrSendFn,
  RdrKeyFactory,
  RdrConfig,
  RdrFlushResult,
  RdrReqHandlerResult,
  RdrResetTimingResult,
  RdrResetActionsResult,
  RdrDestroyResult,
  ActionData,
  ActionSnapshot,
  RequestKeyResult,
  StructuredHashResult,
  HashLimitsConfig,
  EnvSnapshot,
  Enricher,
  EnricherLimitsConfig,
} from './types';

export { hashText, makeRpcRequestKey, makeHttpRequestKey } from '../shared/hash';
export { VERSION } from './config';
