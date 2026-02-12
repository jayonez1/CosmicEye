/** MobX action snapshot entry. */
export interface MobxActionEntry {
  name: string | null;
  storeName: string | null;
  timeSinceMs: number;
}

/** MobX reaction snapshot entry. */
export interface MobxReactionEntry {
  name: string | null;
  timeSinceMs: number;
}

/** Snapshot returned by mobxSpy.snapshot(). Suitable for use as enricher output. */
export interface MobxSpySnapshot {
  lastAction: MobxActionEntry | null;
  lastReaction: MobxReactionEntry | null;
}

/** MobX spy configuration. */
export interface MobxSpyConfig {
  /** Max size of each buffer (actions / reactions). Default: 5. */
  bufferMaxSize?: number;
  /** MobX event types to track. Default: ['action', 'reaction']. */
  trackedTypes?: string[];
  /**
   * Pass `mobx.spy` function from application code.
   * Required for actual event capture; without it `init()` is a no-op.
   *
   * @example
   * import { spy } from 'mobx';
   * mobxSpy.init({ spy });
   */
  spy?: (listener: (event: unknown) => void) => () => void;
}
