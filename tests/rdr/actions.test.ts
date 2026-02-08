import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { actions } from '../../src/rdr/actions';

beforeEach(() => {
  actions.destroy();
});

afterEach(() => {
  actions.destroy();
});

describe('actions', () => {
  describe('init', () => {
    it('does not attach listeners twice on repeated init', () => {
      const spy = vi.spyOn(window, 'addEventListener');

      actions.init();
      const firstCount = spy.mock.calls.length;

      actions.init();
      const secondCount = spy.mock.calls.length;

      expect(secondCount).toBe(firstCount);
      spy.mockRestore();
    });
  });

  describe('snapshot after event', () => {
    it('returns lastAction with correct type after click', () => {
      actions.init();

      const event = new MouseEvent('click', { bubbles: true });
      window.dispatchEvent(event);

      const snap = actions.snapshot(1000);
      expect(snap.lastAction).not.toBeNull();
      expect(snap.lastAction!.type).toBe('click');
      expect(snap.timeSinceLastActionMs).toBeTypeOf('number');
    });

    it('returns lastAction with correct type after keydown', () => {
      actions.init();

      const event = new KeyboardEvent('keydown', { bubbles: true });
      window.dispatchEvent(event);

      const snap = actions.snapshot(1000);
      expect(snap.lastAction).not.toBeNull();
      expect(snap.lastAction!.type).toBe('keydown');
    });

    it('returns rum_id when element has rum-id attribute', () => {
      actions.init();

      const el = document.createElement('button');
      el.setAttribute('rum-id', 'test-btn');
      document.body.appendChild(el);

      const event = new MouseEvent('click', { bubbles: true });
      el.dispatchEvent(event);

      const snap = actions.snapshot(1000);
      expect(snap.lastAction).not.toBeNull();
      expect(snap.lastAction!.rum_id).toBe('test-btn');

      document.body.removeChild(el);
    });

    it('returns null lastAction when no events recorded', () => {
      actions.init();
      const snap = actions.snapshot(1000);
      expect(snap.lastAction).toBeNull();
      expect(snap.timeSinceLastActionMs).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears the buffer', () => {
      actions.init();

      const event = new MouseEvent('click', { bubbles: true });
      window.dispatchEvent(event);

      actions.reset();
      const snap = actions.snapshot(1000);
      expect(snap.lastAction).toBeNull();
    });
  });

  describe('destroy', () => {
    it('removes listeners and clears buffer', () => {
      actions.init();

      const event = new MouseEvent('click', { bubbles: true });
      window.dispatchEvent(event);

      actions.destroy();

      // After destroy, new events should not be tracked
      window.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Re-init to be able to call snapshot (destroy clears state)
      // But we test that no new events accumulated — init fresh
      actions.init();
      const snap = actions.snapshot(1000);
      expect(snap.lastAction).toBeNull();
    });
  });
});
