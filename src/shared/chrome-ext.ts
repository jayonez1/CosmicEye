/**
 * Dispatch a CustomEvent to window for chrome extension integration.
 * @param eventName — 'rdr' or 'rt'
 * @param type — event type, e.g. 'flush', 'event', 'reset'
 * @param data — payload data
 */
export const dispatchExtensionEvent = (eventName: string, type: string, data: unknown): void => {
  try {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { type, data },
      }),
    );
  } catch (_) {
    // nothing
  }
};
