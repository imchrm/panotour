'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = { width: 1400, height: 900 };

function onVisibleDisplay(state, displays) {
  if (!Array.isArray(displays) || displays.length === 0) return false;
  return displays.some((d) => {
    const a = d.workArea ?? d.bounds;
    if (!a) return false;
    return (
      state.x >= a.x - 100 &&
      state.y >= a.y - 50 &&
      state.x < a.x + a.width - 100 &&
      state.y < a.y + a.height - 100
    );
  });
}

function loadWindowState(file, displays) {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { ...DEFAULTS };
  }
  const result = { ...DEFAULTS };
  if (Number.isFinite(state.width) && state.width >= 400) result.width = Math.round(state.width);
  if (Number.isFinite(state.height) && state.height >= 300) result.height = Math.round(state.height);
  if (Number.isFinite(state.x) && Number.isFinite(state.y) && onVisibleDisplay(state, displays)) {
    result.x = Math.round(state.x);
    result.y = Math.round(state.y);
  }
  if (state.maximized === true) result.maximized = true;
  return result;
}

function saveWindowState(file, win) {
  try {
    const maximized = win.isMaximized();
    const bounds = maximized ? win.getNormalBounds() : win.getBounds();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...bounds, maximized }) + '\n', 'utf8');
  } catch { /* best effort */ }
}

module.exports = { loadWindowState, saveWindowState };
