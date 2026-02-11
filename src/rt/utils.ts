import { NORMALIZE_ID_REGEX } from './config';

export { nowMs } from '../shared/time';
export { generateId } from '../shared/generate-id';

export const normalizeRoute = (pathname: string): string =>
  pathname ? pathname.replace(NORMALIZE_ID_REGEX, '/:id') : '/';

export const afterFrames = (callback: () => void, count: number): void => {
  if (count <= 0) {
    callback();
    return;
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => afterFrames(callback, count - 1));
  } else {
    setTimeout(() => afterFrames(callback, count - 1), 16);
  }
};

export const whenIdle = (callback: () => void, timeout: number): void => {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 0);
  }
};
