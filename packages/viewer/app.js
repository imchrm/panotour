import { NavHotspot } from './hotspots/NavHotspot.js';
import { InfoHotspot } from './hotspots/InfoHotspot.js';
import { TransitionEngine } from './transitions/TransitionEngine.js';

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

async function init() {
  const tour = await fetch('tour.json').then(r => r.json());

  const viewerEl = document.getElementById('viewer');
  // Default controls include ScrollZoomControlMethod and PinchZoomControlMethod.
  // Marzipano uses velocity+friction dynamics — smooth deceleration, not a hard jump.
  const viewer = new Marzipano.Viewer(viewerEl, {
    controls: { mouseViewMode: 'drag' },
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
    const limiter = Marzipano.RectilinearView.limit.traditional(
      maxSize, 100 * Math.PI / 180, 120 * Math.PI / 180
    );
    const view = new Marzipano.RectilinearView(sceneData.initialView, limiter);
    const marzipanoScene = viewer.createScene({
      source, geometry, view, pinFirstLevel: true,
    });

    scenes.set(sceneData.id, { marzipanoScene, data: sceneData });
  }

  const engine = new TransitionEngine(viewer, scenes);
  let currentSceneId = tour.defaultSceneId || tour.scenes[0]?.id;

  // Add hotspots for every scene (use original tour.scenes for hotspot data)
  for (const sceneData of tour.scenes) {
    const entry = scenes.get(sceneData.id);
    if (!entry) continue;

    for (const hotspot of sceneData.hotspots) {
      if (hotspot.type === 'link') {
        NavHotspot.create(entry.marzipanoScene, hotspot, (h) => {
          engine.navigate(currentSceneId, h);
          currentSceneId = h.targetSceneId;
        });
      } else if (hotspot.type === 'info') {
        InfoHotspot.create(entry.marzipanoScene, hotspot);
      }
    }
  }

  // Show default scene
  const defaultEntry = scenes.get(currentSceneId);
  if (defaultEntry) {
    defaultEntry.marzipanoScene.switchTo();
  }

  // ----- Mobile: native pinch-to-zoom -----
  // Marzipano's built-in PinchZoom via Hammer.js can be intercepted by the
  // browser's native page-zoom on some devices. Capture-phase listeners
  // intercept 2-finger gestures before Hammer.js, giving direct FOV control.
  // 1-finger pan is unaffected (passes through to Marzipano/Hammer.js).
  const FOV_MIN = 0.2;   // ~11°
  const FOV_MAX = 2.094; // ~120°
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
  document.body.innerHTML = `<div style="color:#fff;padding:20px">Failed to load tour.json: ${err.message}</div>`;
});
