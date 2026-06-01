'use strict';

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
