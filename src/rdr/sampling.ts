import { SAMPLING, IS_DEV } from './config';
import { hashText } from './hash';

let _clientId: string | null = null;
let _isSampled: boolean | null = null;

const _getClientId = (): string => {
  if (_clientId !== null) {
    return _clientId;
  }

  try {
    _clientId = localStorage.getItem(SAMPLING.STORAGE_KEY);

    if (!_clientId) {
      _clientId = crypto?.randomUUID?.() || String(Math.random()) + String(Date.now());
      localStorage.setItem(SAMPLING.STORAGE_KEY, _clientId);
    }
  } catch (_) {
    _clientId = String(Math.random()) + String(Date.now());
  }

  return _clientId;
};

export const shouldEnableSample = (): boolean => {
  if (IS_DEV) {
    return true;
  }

  if (_isSampled !== null) {
    return _isSampled;
  }

  try {
    const id = _getClientId();
    const h = hashText(id);
    const bucket = (parseInt(h, 16) % 10000) / 10000;

    _isSampled = bucket < SAMPLING.RATE;
  } catch (_) {
    _isSampled = false;
  }

  return _isSampled;
};

/** Reset internal cache — exposed for testing only. */
export const _resetSamplingState = (): void => {
  _clientId = null;
  _isSampled = null;
};
