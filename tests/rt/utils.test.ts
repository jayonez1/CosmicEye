import { describe, it, expect } from 'vitest';
import { normalizeRoute, generateId } from '../../src/rt/utils';

describe('normalizeRoute', () => {
  it('replaces numeric segments with :id', () => {
    expect(normalizeRoute('/users/123')).toBe('/users/:id');
  });

  it('replaces multiple numeric segments', () => {
    expect(normalizeRoute('/orders/789/items/42')).toBe('/orders/:id/items/:id');
  });

  it('does not replace non-numeric segments', () => {
    expect(normalizeRoute('/users/profile')).toBe('/users/profile');
  });

  it('handles root path', () => {
    expect(normalizeRoute('/')).toBe('/');
  });

  it('returns / for empty string', () => {
    expect(normalizeRoute('')).toBe('/');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});
