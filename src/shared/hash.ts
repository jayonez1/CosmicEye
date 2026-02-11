import type { HashLimitsConfig, RequestKeyResult, StructuredHashResult } from './types';

export const DEFAULT_HASH_LIMITS: HashLimitsConfig = {
  MAX_DEPTH: 20,
  MAX_NODES: 5_000,
  MAX_OBJECT_KEYS: 300,
  MAX_ARRAY_ITEMS: 1_000,
  MAX_STRING_CHARS: 2_048,
} as const;

const HASH_SEED = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

interface Hasher {
  write: (text: string) => void;
  hex: () => string;
}

const _makeHasher = (): Hasher => {
  let state = HASH_SEED;

  const write = (text: string): void => {
    const value = String(text);
    for (let i = 0; i < value.length; i++) {
      state ^= value.charCodeAt(i);
      state = Math.imul(state, HASH_PRIME) >>> 0;
    }
  };

  const hex = (): string => (state >>> 0).toString(16).padStart(8, '0');

  return { write, hex };
};

export const hashText = (text: string): string => {
  const hasher = _makeHasher();
  hasher.write(text);
  return hasher.hex();
};

export const hashStructuredData = (
  input: unknown,
  limits: HashLimitsConfig = DEFAULT_HASH_LIMITS,
): StructuredHashResult => {
  const pathObjects = new WeakSet();
  const hasher = _makeHasher();
  let nodesVisited = 0;
  let wasTruncated = false;

  const writeToken = (token: string): void => {
    hasher.write(token);
  };

  const writeString = (str: string): void => {
    writeToken('str:');
    if (str.length > limits.MAX_STRING_CHARS) {
      wasTruncated = true;
      writeToken(str.slice(0, limits.MAX_STRING_CHARS));
      writeToken(`#len=${str.length}`);
      return;
    }
    writeToken(str);
  };

  const writeNumber = (num: number): void => {
    if (Number.isNaN(num)) {
      writeToken('num:NaN');
      return;
    }
    if (num === Infinity) {
      writeToken('num:Infinity');
      return;
    }
    if (num === -Infinity) {
      writeToken('num:-Infinity');
      return;
    }
    if (Object.is(num, -0)) {
      writeToken('num:-0');
      return;
    }

    writeToken(`num:${num}`);
  };

  const walk = (value: unknown, depth: number): void => {
    if (nodesVisited++ >= limits.MAX_NODES) {
      wasTruncated = true;
      writeToken('[maxNodes]');
      return;
    }

    if (depth > limits.MAX_DEPTH) {
      wasTruncated = true;
      writeToken('[maxDepth]');
      return;
    }

    if (value === null) {
      writeToken('null');
      return;
    }

    const type = typeof value;

    if (type === 'string') {
      return writeString(value as string);
    }
    if (type === 'number') {
      return writeNumber(value as number);
    }
    if (type === 'boolean') {
      writeToken(value ? 'bool:true' : 'bool:false');
      return;
    }
    if (type === 'bigint') {
      writeToken(`bigint:${(value as bigint).toString()}`);
      return;
    }
    if (type === 'undefined') {
      writeToken('undef');
      return;
    }
    if (type === 'symbol') {
      writeToken(`symbol:${String(value)}`);
      return;
    }
    if (type === 'function') {
      writeToken('function');
      return;
    }

    if (value instanceof Date) {
      const ts = value.getTime();

      if (Number.isNaN(ts)) {
        wasTruncated = true;
        writeToken('date:Invalid');
        return;
      }

      writeToken('date:');
      writeToken(value.toISOString());
      return;
    }

    const obj = value as object;

    if (pathObjects.has(obj)) {
      wasTruncated = true;
      writeToken('[circular]');
      return;
    }

    pathObjects.add(obj);

    try {
      if (Array.isArray(obj)) {
        writeToken('[');
        const itemsToHash = Math.min(obj.length, limits.MAX_ARRAY_ITEMS);

        if (obj.length > itemsToHash) {
          wasTruncated = true;
        }

        for (let i = 0; i < itemsToHash; i++) {
          writeToken(`i:${i}|`);
          walk(obj[i], depth + 1);
          writeToken(';');
        }

        if (obj.length > itemsToHash) {
          writeToken(`#len=${obj.length}`);
        }
        writeToken(']');
        return;
      }

      writeToken('{');

      const sortedKeys = Object.keys(obj).sort();
      const keysToHash = Math.min(sortedKeys.length, limits.MAX_OBJECT_KEYS);

      if (sortedKeys.length > keysToHash) {
        wasTruncated = true;
      }

      for (let i = 0; i < keysToHash; i++) {
        const key = sortedKeys[i];
        const propValue = (obj as Record<string, unknown>)[key];

        if (propValue === undefined) {
          continue;
        }

        writeToken('k:');
        writeString(key);
        writeToken('|v:');
        walk(propValue, depth + 1);
        writeToken(';');
      }

      if (sortedKeys.length > keysToHash) {
        writeToken(`#keys=${sortedKeys.length}`);
      }
      writeToken('}');
    } catch (_) {
      wasTruncated = true;
      writeToken('[unhashableObject]');
    } finally {
      pathObjects.delete(obj);
    }
  };

  walk(input, 0);

  return {
    hashHex: hasher.hex(),
    wasTruncated,
    nodesVisited,
  };
};

/**
 * Generate a request fingerprint for RPC-style requests (service + method + params + body).
 * Renamed from the former `makeRequestKey`.
 */
export const makeRpcRequestKey = (
  apiMessage: { s?: string; m?: string; p?: unknown; b?: unknown },
  limits: HashLimitsConfig = DEFAULT_HASH_LIMITS,
): RequestKeyResult => {
  const serviceName = String(apiMessage?.s ?? '');
  const methodName = String(apiMessage?.m ?? '');
  const endpoint = `${serviceName}.${methodName}`;
  const endpointHash = hashText(endpoint);
  const paramsHash = hashStructuredData(apiMessage?.p ?? {}, limits);
  const bodyHash = hashStructuredData(apiMessage?.b ?? {}, limits);

  const truncationMask = (paramsHash.wasTruncated ? 1 : 0) | (bodyHash.wasTruncated ? 2 : 0);

  return {
    endpoint,
    reqHash: `req_${endpointHash}_${paramsHash.hashHex}_${bodyHash.hashHex}_${truncationMask}`,
  };
};

/** @deprecated Use `makeRpcRequestKey` instead. Will be removed in a future version. */
export const makeRequestKey = makeRpcRequestKey;

/**
 * Generate a request fingerprint for HTTP-style requests (method + endpoint URL + body text).
 * httpMethod is included in the hash to avoid false collisions (e.g. GET vs POST to same URL).
 */
export const makeHttpRequestKey = (
  request: { httpMethod: string; endpoint: string; bodyText?: string },
  limits: HashLimitsConfig = DEFAULT_HASH_LIMITS,
): RequestKeyResult => {
  const method = String(request.httpMethod ?? '').toUpperCase();
  const endpoint = String(request.endpoint ?? '');
  const bodyText = String(request.bodyText ?? '');

  const endpointWithMethod = `${method}:${endpoint}`;
  const endpointHash = hashText(endpointWithMethod);

  const truncatedBody = bodyText.length > limits.MAX_STRING_CHARS
    ? bodyText.slice(0, limits.MAX_STRING_CHARS)
    : bodyText;
  const bodyHash = hashText(truncatedBody);
  const wasTruncated = bodyText.length > limits.MAX_STRING_CHARS;

  const truncationMask = wasTruncated ? 2 : 0;

  return {
    endpoint: endpointWithMethod,
    reqHash: `req_${endpointHash}_${bodyHash}_${truncationMask}`,
  };
};
