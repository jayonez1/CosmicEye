import type { EnvSnapshot, NavigatorWithConnection } from './types';

export const env = {
  snapshot(): EnvSnapshot {
    const result: EnvSnapshot = {
      visibility: 'unknown',
      net: null,
    };

    try {
      if (typeof document !== 'undefined' && document.visibilityState) {
        result.visibility = document.visibilityState;
      }
    } catch (_) {
      // nothing
    }

    try {
      const nav = navigator as NavigatorWithConnection;
      const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

      if (conn) {
        result.net = {
          effectiveType: conn.effectiveType || null,
        };
      }
    } catch (_) {
      // nothing
    }

    return result;
  },
};
