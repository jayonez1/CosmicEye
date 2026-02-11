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
    it('does not throw when mobx is not installed', () => {
      expect(() => mobxSpy.init()).not.toThrow();
    });

    it('accepts config', () => {
      expect(() => mobxSpy.init({ bufferMaxSize: 10, trackedTypes: ['action'] })).not.toThrow();
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

  describe('as enricher', () => {
    it('snapshot can be used as enricher get function', () => {
      const enricher = { name: 'mobx', get: (nowMs: number) => mobxSpy.snapshot(nowMs) };
      const result = enricher.get(1000);
      expect(result).toEqual({ lastAction: null, lastReaction: null });
    });
  });
});
