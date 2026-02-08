import { CHROME_EXT } from './config';
import type { LogEntry } from './types';

export const nowMs = (): number => Math.round(performance.now());

export const elapsedMs = (since: number): number => {
  const current = nowMs();
  const sinceRounded = typeof since === 'number' ? Math.round(since) : 0;

  return current - sinceRounded;
};

export const sendToExtension = (logEntry: LogEntry): void => {
  try {
    window.dispatchEvent(
      new CustomEvent(CHROME_EXT.EVENT_NAME, {
        detail: { type: 'log', data: logEntry },
      }),
    );
  } catch (_) {
    // nothing
  }
};

export const resetExtension = (): void => {
  try {
    window.dispatchEvent(
      new CustomEvent(CHROME_EXT.EVENT_NAME, {
        detail: { type: 'reset' },
      }),
    );
  } catch (_) {
    // nothing
  }
};
