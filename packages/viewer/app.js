import { NavHotspot } from './hotspots/NavHotspot.js';
import { InfoHotspot } from './hotspots/InfoHotspot.js';
import { TransitionEngine } from './transitions/TransitionEngine.js';
import { lang, t } from './i18n.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const log = (...args) => { if (DEBUG) console.log('[panotour]', ...args); };

log('init', {
  tourId:   location.pathname.split('/').filter(Boolean).at(-1) ?? '(root)',
  lang,
  scene:    new URLSearchParams(location.search).get('scene') ?? '(default)',
  embedded: window.parent !== window,
});

function isMobile() {
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  // maxTouchPoints > 1 alone is unreliable: Windows touchscreen monitors
  // report 10 touch points on desktop. Require small screen as well.
  const touchSmall = navigator.maxTouchPoints > 1 && window.screen.width <= 768;
  return mobileUA || touchSmall;
}

async function resolveSceneData(sceneData) {
  if (!isMobile()) return sceneData;

  const mobilePath = `${sceneData.tilesPath}/mobile`;
  try {
    const res = await fetch(`${mobilePath}/manifest.json`);
    if (!res.ok) return sceneData;
    const { levels } = await res.json();
    return {
      ...sceneData,
      tilesPath: mobilePath,
      previewUrl: `${mobilePath}/preview.jpg`,
      levels,
    };
  } catch {
    return sceneData;
  }
}

function exitTour(reason) {
  log(`-> TOUR_EXIT (${reason})`);
  window.parent.postMessage({ type: 'TOUR_EXIT' }, '*');
}

// Activity beacon: throttled postMessage to parent so the kiosk inactivity
// timer resets while the user interacts inside the iframe.
(function initActivityBeacon() {
  if (window.parent === window) return;
  const INTERVAL_MS = 2500;
  let last = 0;
  function ping() {
    const now = Date.now();
    if (now - last < INTERVAL_MS) return;
    last = now;
    log('-> TOUR_ACTIVITY');
    window.parent.postMessage({ type: 'TOUR_ACTIVITY' }, '*');
  }
  const events = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'touchmove'];
  const opts = { capture: true, passive: true };
  events.forEach((ev) => window.addEventListener(ev, ping, opts));
  window.addEventListener('beforeunload', () => {
    events.forEach((ev) => window.removeEventListener(ev, ping, opts));
  });
})();

// Exit button — fixed top-left, above viewer
const exitBtn = document.createElement('button');
exitBtn.className = 'exit-btn';
exitBtn.textContent = t('btn.exit');
exitBtn.addEventListener('click', () => exitTour('button'));
document.body.appendChild(exitBtn);

// Global Escape: exit tour only when no info panel is open
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.querySelector('.info-panel-overlay')) {
    exitTour('Escape');
  }
});

async function init() {
  const tour = await fetch('tour.json').then(r => r.json());

  const viewerEl = document.getElementById('viewer');
  const viewer = new Marzipano.Viewer(viewerEl, {
    controls: { mouseViewMode: 'drag', scrollZoom: false },
  });

  // Resolve mobile tiles for all scenes in parallel (graceful fallback to desktop)
  const resolvedScenes = await Promise.all(tour.scenes.map(resolveSceneData));

  // scenes: Map<sceneId, { marzipanoScene, data }>
  const scenes = new Map();

  for (const sceneData of resolvedScenes) {
    const geometry = new Marzipano.CubeGeometry(sceneData.levels);
    const source = Marzipano.ImageUrlSource.fromString(
      `${sceneData.tilesPath}/{z}/{f}/{y}/{x}.jpg`,
      { cubeMapPreviewUrl: sceneData.previewUrl }
    );
    const maxSize = sceneData.levels.reduce((m, l) => Math.max(m, l.size), 0);
    // traditional() uses faceSize to compute minimum FOV (zoom-in limit).
    // With small tiles (faceSize=1024), minFOV can exceed maxFOV, breaking zoom.
    // Clamp to at least 4096 so the resolution limiter stays below maxVFOV=100°.
    const limiterFaceSize = Math.max(maxSize, 4096);
    const limiter = Marzipano.RectilinearView.limit.traditional(
      limiterFaceSize, 100 * Math.PI / 180, 120 * Math.PI / 180
    );
    const view = new Marzipano.RectilinearView(sceneData.initialView, limiter);
    const marzipanoScene = viewer.createScene({
      source, geometry, view, pinFirstLevel: true,
    });

    scenes.set(sceneData.id, { marzipanoScene, data: sceneData });
  }

  const engine = new TransitionEngine(viewer, scenes);

  // Starting scene: ?scene=sceneId URL param → defaultSceneId → first scene
  const urlSceneId = new URLSearchParams(location.search).get('scene');
  let currentSceneId = (urlSceneId && scenes.has(urlSceneId))
    ? urlSceneId
    : (tour.defaultSceneId || tour.scenes[0]?.id);

  // Add hotspots for every scene (use original tour.scenes for hotspot data)
  for (const sceneData of tour.scenes) {
    const entry = scenes.get(sceneData.id);
    if (!entry) continue;

    for (const hotspot of sceneData.hotspots) {
      if (hotspot.type === 'link') {
        NavHotspot.create(entry.marzipanoScene, hotspot, (h) => {
          // Cancel any pending scroll-zoom animation so the old fovTarget
          // is not applied to the new scene's view during the transition.
          fovTarget = null;
          engine.navigate(currentSceneId, h);
          currentSceneId = h.targetSceneId;
        });
      } else if (hotspot.type === 'info') {
        InfoHotspot.create(entry.marzipanoScene, hotspot);
      }
    }
  }

  // postMessage from kiosk: { type: 'TOUR_NAVIGATE', sceneId, yaw?, pitch?, fov? }
  // Performs a direct crossfade to the target scene using its initialView
  // (caller may override yaw/pitch/fov for a specific arrival direction).
  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'TOUR_NAVIGATE') return;
    const targetId = e.data.sceneId;
    if (!targetId || !scenes.has(targetId) || targetId === currentSceneId) return;
    const entry = scenes.get(targetId);
    const iv = entry.data.initialView;
    fovTarget = null;
    entry.marzipanoScene.view().setParameters({
      yaw:   e.data.yaw   ?? iv.yaw,
      pitch: e.data.pitch ?? iv.pitch,
      fov:   e.data.fov   ?? iv.fov,
    });
    entry.marzipanoScene.switchTo({ transitionDuration: 600 });
    currentSceneId = targetId;
  });

  // Show starting scene
  const defaultEntry = scenes.get(currentSceneId);
  if (defaultEntry) {
    defaultEntry.marzipanoScene.switchTo();
  }

  // Keep --hs-scale in sync with FOV so hotspots scale with zoom.
  // REF_FOV is the FOV at which scale=1 (hotspot renders at its CSS size).
  const REF_FOV = Math.PI / 2;
  (function tickScale() {
    const entry = scenes.get(currentSceneId);
    if (entry) {
      const fov = entry.marzipanoScene.view().fov();
      viewerEl.style.setProperty('--hs-scale', (REF_FOV / fov).toFixed(4));
    }
    requestAnimationFrame(tickScale);
  })();

  const FOV_MIN = 0.2;   // ~11°
  const FOV_MAX = 2.094; // ~120°

  // ----- Desktop: scroll-wheel zoom -----
  // Marzipano's built-in scroll zoom uses velocity+friction dynamics that can
  // silently fail in some browser/device combinations. This direct handler is
  // more reliable. fovTarget accumulates wheel deltas; a single RAF loop eases
  // toward it so mouse wheel and trackpad both feel smooth.
  let fovTarget = null;
  let wheelRaf = null;

  function wheelAnimate() {
    const entry = scenes.get(currentSceneId);
    if (!entry || fovTarget === null) { wheelRaf = null; return; }
    const view = entry.marzipanoScene.view();
    const cur = view.fov();
    const diff = fovTarget - cur;
    if (Math.abs(diff) < 0.0005) {
      view.setFov(fovTarget);
      fovTarget = null;
      wheelRaf = null;
      return;
    }
    view.setFov(cur + diff * 0.18);
    wheelRaf = requestAnimationFrame(wheelAnimate);
  }

  viewerEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const entry = scenes.get(currentSceneId);
    if (!entry) return;
    const view = entry.marzipanoScene.view();
    const base = fovTarget ?? view.fov();
    const capped = Math.max(-50, Math.min(50, e.deltaY));
    fovTarget = Math.max(FOV_MIN, Math.min(FOV_MAX, base * (1 + capped * 0.0025)));
    if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelAnimate);
  }, { passive: false });

  // ----- Mobile: native pinch-to-zoom -----
  // Marzipano's built-in PinchZoom via Hammer.js can be intercepted by the
  // browser's native page-zoom on some devices. Capture-phase listeners
  // intercept 2-finger gestures before Hammer.js, giving direct FOV control.
  // 1-finger pan is unaffected (passes through to Marzipano/Hammer.js).
  let pinchDist0 = null;
  let pinchFov0 = null;

  viewerEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.stopPropagation();
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      pinchDist0 = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const entry = scenes.get(currentSceneId);
      pinchFov0 = entry ? entry.marzipanoScene.view().fov() : null;
    } else {
      pinchDist0 = null;
      pinchFov0 = null;
    }
  }, { capture: true, passive: false });

  viewerEl.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || pinchDist0 === null || pinchFov0 === null) return;
    e.stopPropagation();
    e.preventDefault();
    const t0 = e.touches[0], t1 = e.touches[1];
    const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    const newFov = Math.max(FOV_MIN, Math.min(FOV_MAX, pinchFov0 * pinchDist0 / dist));
    const entry = scenes.get(currentSceneId);
    if (entry) entry.marzipanoScene.view().setFov(newFov);
  }, { capture: true, passive: false });

  viewerEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) { pinchDist0 = null; pinchFov0 = null; }
  }, { capture: true, passive: true });
}

init().catch(err => {
  console.error('panotour: failed to load tour', err);
  document.body.innerHTML = `<div style="color:#fff;padding:20px">${t('error.load')}: ${err.message}</div>`;
});
