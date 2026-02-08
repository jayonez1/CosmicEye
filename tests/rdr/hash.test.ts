import { describe, it, expect } from 'vitest';
import { hashText, makeRequestKey, hashStructuredData } from '../../src/rdr/hash';
import { HASH_LIMITS } from '../../src/rdr/config';

describe('hashText', () => {
  it('returns deterministic hash for the same input', () => {
    const a = hashText('hello');
    const b = hashText('hello');
    expect(a).toBe(b);
  });

  it('returns different hashes for different inputs', () => {
    const a = hashText('hello');
    const b = hashText('world');
    expect(a).not.toBe(b);
  });

  it('returns an 8-character hex string', () => {
    const h = hashText('test');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles empty string', () => {
    const h = hashText('');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('makeRequestKey', () => {
  it('produces identical reqHash for same params with different key order', () => {
    const a = makeRequestKey({ s: 'Svc', m: 'get', p: { x: 1, y: 2 }, b: {} });
    const b = makeRequestKey({ s: 'Svc', m: 'get', p: { y: 2, x: 1 }, b: {} });
    expect(a.reqHash).toBe(b.reqHash);
  });

  it('changes reqHash when service name changes', () => {
    const a = makeRequestKey({ s: 'Svc', m: 'get', p: {}, b: {} });
    const b = makeRequestKey({ s: 'Other', m: 'get', p: {}, b: {} });
    expect(a.reqHash).not.toBe(b.reqHash);
  });

  it('changes reqHash when method name changes', () => {
    const a = makeRequestKey({ s: 'Svc', m: 'get', p: {}, b: {} });
    const b = makeRequestKey({ s: 'Svc', m: 'post', p: {}, b: {} });
    expect(a.reqHash).not.toBe(b.reqHash);
  });

  it('changes reqHash when params change', () => {
    const a = makeRequestKey({ s: 'Svc', m: 'get', p: { id: 1 }, b: {} });
    const b = makeRequestKey({ s: 'Svc', m: 'get', p: { id: 2 }, b: {} });
    expect(a.reqHash).not.toBe(b.reqHash);
  });

  it('changes reqHash when body changes', () => {
    const a = makeRequestKey({ s: 'Svc', m: 'get', p: {}, b: { data: 'a' } });
    const b = makeRequestKey({ s: 'Svc', m: 'get', p: {}, b: { data: 'b' } });
    expect(a.reqHash).not.toBe(b.reqHash);
  });

  it('returns correct endpoint format', () => {
    const result = makeRequestKey({ s: 'UserService', m: 'getProfile', p: {}, b: {} });
    expect(result.endpoint).toBe('UserService.getProfile');
  });

  it('returns reqHash with expected prefix format', () => {
    const result = makeRequestKey({ s: 'Svc', m: 'get', p: {}, b: {} });
    expect(result.reqHash).toMatch(/^req_[0-9a-f]{8}_[0-9a-f]{8}_[0-9a-f]{8}_\d$/);
  });

  it('sets truncationMask when params exceed limits', () => {
    const tinyLimits = { ...HASH_LIMITS, MAX_OBJECT_KEYS: 1 };
    const params = { a: 1, b: 2, c: 3 };
    const result = makeRequestKey({ s: 'Svc', m: 'get', p: params, b: {} }, tinyLimits);
    const mask = parseInt(result.reqHash.split('_').pop()!, 10);
    expect(mask & 1).toBe(1); // params truncated
  });

  it('sets truncationMask when body exceeds limits', () => {
    const tinyLimits = { ...HASH_LIMITS, MAX_STRING_CHARS: 2 };
    const body = { longKey: 'a'.repeat(100) };
    const result = makeRequestKey({ s: 'Svc', m: 'get', p: {}, b: body }, tinyLimits);
    const mask = parseInt(result.reqHash.split('_').pop()!, 10);
    expect(mask & 2).toBe(2); // body truncated
  });
});

describe('hashStructuredData', () => {
  it('handles Date objects', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    const result = hashStructuredData(d);
    expect(result.hashHex).toMatch(/^[0-9a-f]{8}$/);
    expect(result.wasTruncated).toBe(false);
  });

  it('handles invalid Date without crashing', () => {
    const d = new Date('invalid');
    const result = hashStructuredData(d);
    expect(result.wasTruncated).toBe(true);
    expect(result.hashHex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles NaN', () => {
    const result = hashStructuredData(NaN);
    expect(result.hashHex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles Infinity', () => {
    const result = hashStructuredData(Infinity);
    expect(result.hashHex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles circular references without crashing', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = hashStructuredData(obj);
    expect(result.wasTruncated).toBe(true);
    expect(result.hashHex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('truncates when maxNodes is exceeded', () => {
    const tinyLimits = { ...HASH_LIMITS, MAX_NODES: 3 };
    const data = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const result = hashStructuredData(data, tinyLimits);
    expect(result.wasTruncated).toBe(true);
  });

  it('truncates when maxDepth is exceeded', () => {
    const tinyLimits = { ...HASH_LIMITS, MAX_DEPTH: 2 };
    const data = { a: { b: { c: { d: 1 } } } };
    const result = hashStructuredData(data, tinyLimits);
    expect(result.wasTruncated).toBe(true);
  });

  it('handles arrays correctly', () => {
    const a = hashStructuredData([1, 2, 3]);
    const b = hashStructuredData([1, 2, 3]);
    expect(a.hashHex).toBe(b.hashHex);
  });

  it('differentiates arrays with different content', () => {
    const a = hashStructuredData([1, 2, 3]);
    const b = hashStructuredData([1, 2, 4]);
    expect(a.hashHex).not.toBe(b.hashHex);
  });

  it('handles null', () => {
    const result = hashStructuredData(null);
    expect(result.hashHex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles boolean, bigint, undefined, symbol, function', () => {
    expect(hashStructuredData(true).hashHex).toMatch(/^[0-9a-f]{8}$/);
    expect(hashStructuredData(false).hashHex).toMatch(/^[0-9a-f]{8}$/);
    expect(hashStructuredData(BigInt(42)).hashHex).toMatch(/^[0-9a-f]{8}$/);
    expect(hashStructuredData(undefined).hashHex).toMatch(/^[0-9a-f]{8}$/);
    expect(hashStructuredData(Symbol('test')).hashHex).toMatch(/^[0-9a-f]{8}$/);
    expect(hashStructuredData(() => {}).hashHex).toMatch(/^[0-9a-f]{8}$/);
  });
});
