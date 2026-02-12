import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mobxSpy } from '../../../src/extensions/mobx-spy';

beforeEach(() => {
  mobxSpy.destroy();
});

afterEach(() => {
  mobxSpy.destroy();
});

describe('mobxSpy', () => {
  describe('init', () => {
    it('does not throw when spy is not provided (no-op)', () => {
      expect(() => mobxSpy.init()).not.toThrow();
    });

    it('accepts config without spy and stays no-op', () => {
      expect(() => mobxSpy.init({ bufferMaxSize: 10, trackedTypes: ['action'] })).not.toThrow();
      const snap = mobxSpy.snapshot();
      expect(snap).toEqual({ lastAction: null, lastReaction: null });
    });
  });

  describe('snapshot', () => {
    it('returns empty snapshot when no events', () => {
      const snap = mobxSpy.snapshot();
      expect(snap).toEqual({ lastAction: null, lastReaction: null });
    });

    it('accepts optional currentTime parameter', () => {
      const snap = mobxSpy.snapshot(1000);
      expect(snap).toEqual({ lastAction: null, lastReaction: null });
    });
  });

  describe('reset', () => {
    it('does not throw', () => {
      expect(() => mobxSpy.reset()).not.toThrow();
    });

    it('clears buffers — snapshot returns nulls after reset', () => {
      mobxSpy.reset();
      const snap = mobxSpy.snapshot();
      expect(snap.lastAction).toBeNull();
      expect(snap.lastReaction).toBeNull();
    });
  });

  describe('destroy', () => {
    it('does not throw', () => {
      expect(() => mobxSpy.destroy()).not.toThrow();
    });

    it('is idempotent', () => {
      mobxSpy.destroy();
      expect(() => mobxSpy.destroy()).not.toThrow();
    });

    it('clears buffers', () => {
      mobxSpy.destroy();
      const snap = mobxSpy.snapshot();
      expect(snap.lastAction).toBeNull();
      expect(snap.lastReaction).toBeNull();
    });
  });

  describe('with spy config (recommended path)', () => {
    it('captures actions when spy function provided', () => {
      let listener: ((event: unknown) => void) | null = null;
      const fakeSpy = (fn: (event: unknown) => void) => {
        listener = fn;
        return () => { listener = null; };
      };

      mobxSpy.init({ spy: fakeSpy });

      // Simulate MobX action event
      listener!({ type: 'action', name: 'fetchUsers', object: { constructor: { name: 'UserStore' } } });

      const snap = mobxSpy.snapshot(1000);
      expect(snap.lastAction).not.toBeNull();
      expect(snap.lastAction!.name).toBe('fetchUsers');
      expect(snap.lastAction!.storeName).toBe('UserStore');
    });

    it('captures reactions when spy function provided', () => {
      let listener: ((event: unknown) => void) | null = null;
      const fakeSpy = (fn: (event: unknown) => void) => {
        listener = fn;
        return () => { listener = null; };
      };

      mobxSpy.init({ spy: fakeSpy });

      listener!({ type: 'reaction', name: 'autorun@42' });

      const snap = mobxSpy.snapshot(1000);
      expect(snap.lastReaction).not.toBeNull();
      expect(snap.lastReaction!.name).toBe('autorun@42');
    });

    it('respects trackedTypes filter', () => {
      let listener: ((event: unknown) => void) | null = null;
      const fakeSpy = (fn: (event: unknown) => void) => {
        listener = fn;
        return () => { listener = null; };
      };

      mobxSpy.init({ spy: fakeSpy, trackedTypes: ['action'] });

      listener!({ type: 'reaction', name: 'ignored' });
      listener!({ type: 'action', name: 'tracked' });

      const snap = mobxSpy.snapshot(1000);
      expect(snap.lastReaction).toBeNull();
      expect(snap.lastAction!.name).toBe('tracked');
    });

    it('respects bufferMaxSize — resets on overflow', () => {
      let listener: ((event: unknown) => void) | null = null;
      const fakeSpy = (fn: (event: unknown) => void) => {
        listener = fn;
        return () => { listener = null; };
      };

      mobxSpy.init({ spy: fakeSpy, bufferMaxSize: 2 });

      listener!({ type: 'action', name: 'a1' });
      listener!({ type: 'action', name: 'a2' });
      // Buffer full — next push should clear and add
      listener!({ type: 'action', name: 'a3' });

      const snap = mobxSpy.snapshot(1000);
      expect(snap.lastAction!.name).toBe('a3');
    });

    it('destroy disconnects spy listener', () => {
      let listener: ((event: unknown) => void) | null = null;
      const fakeSpy = (fn: (event: unknown) => void) => {
        listener = fn;
        return () => { listener = null; };
      };

      mobxSpy.init({ spy: fakeSpy });
      expect(listener).not.toBeNull();

      mobxSpy.destroy();
      expect(listener).toBeNull();

      const snap = mobxSpy.snapshot();
      expect(snap.lastAction).toBeNull();
    });

    it('is idempotent — second init is no-op', () => {
      let callCount = 0;
      const fakeSpy = (_fn: (event: unknown) => void) => {
        callCount++;
        return () => {};
      };

      mobxSpy.init({ spy: fakeSpy });
      mobxSpy.init({ spy: fakeSpy });

      expect(callCount).toBe(1);
    });

    it('swallows spy attach errors', () => {
      const fakeSpy = () => {
        throw new Error('boom');
      };

      expect(() => mobxSpy.init({ spy: fakeSpy })).not.toThrow();
      expect(mobxSpy.snapshot()).toEqual({ lastAction: null, lastReaction: null });
    });
  });

  describe('as enricher', () => {
    it('snapshot can be used as enricher get function', () => {
      const enricher = { name: 'mobx', get: (nowMs: number) => mobxSpy.snapshot(nowMs) };
      const result = enricher.get(1000);
      expect(result).toEqual({ lastAction: null, lastReaction: null });
    });
  });
});
