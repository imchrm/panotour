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
  // scrollZoom: false — disable Marzipano's built-in scroll zoom (zoomDelta=0.001 is too
  // subtle on trackpads). We attach our own wheel handler below with tuned sensitivity.
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
    const limiter = Marzipano.RectilinearView.limit.traditional(
      maxSize, 120 * Math.PI / 180
    );
    const view = new Marzipano.RectilinearView(sceneData.initialView, limiter);
    const marzipanoScene = viewer.createScene({
      source, geometry, view, pinFirstLevel: true,
    });

    scenes.set(sceneData.id, { marzipanoScene, data: sceneData });
  }

  // ----- zoom state (shared between scroll and pinch handlers) -----
  const FOV_MIN = 0.2;   // ~11°
  const FOV_MAX = 2.094; // ~120°

  let zoomTarget = null;
  let zoomRaf = null;

  function cancelZoom() {
    if (zoomRaf) { cancelAnimationFrame(zoomRaf); zoomRaf = null; }
  }

  function smoothFov(view) {
    cancelZoom();
    function step() {
      const cur = view.fov();
      const diff = zoomTarget - cur;
      if (Math.abs(diff) < 0.001) { view.setFov(zoomTarget); zoomRaf = null; return; }
      view.setFov(cur + diff * 0.18); // exponential ease-out: ~160 ms to settle
      zoomRaf = requestAnimationFrame(step);
    }
    zoomRaf = requestAnimationFrame(step);
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
          cancelZoom();
          zoomTarget = null;
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

  // ----- Desktop: scroll wheel / trackpad zoom -----
  // Smooth lerp animation instead of direct setFov jump.
  viewerEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const entry = scenes.get(currentSceneId);
    if (!entry) return;
    const view = entry.marzipanoScene.view();
    if (zoomTarget === null) zoomTarget = view.fov();
    const px = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
    const delta = Math.sign(px) * Math.min(Math.abs(px) * 0.004, 0.15);
    zoomTarget = Math.max(FOV_MIN, Math.min(FOV_MAX, zoomTarget + delta));
    smoothFov(view);
  }, { passive: false });

  // ----- Mobile: native pinch-to-zoom (capture phase, before Hammer.js) -----
  // Using capture phase + stopPropagation prevents Marzipano's built-in PinchZoom
  // from running simultaneously and causing double-zoom.
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
      zoomTarget = pinchFov0;
      cancelZoom();
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
    if (entry) {
      zoomTarget = newFov;
      entry.marzipanoScene.view().setFov(newFov);
    }
  }, { capture: true, passive: false });

  viewerEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      pinchDist0 = null;
      pinchFov0 = null;
    }
  }, { capture: true, passive: true });
}

init().catch(err => {
  console.error('panotour: failed to load tour', err);
  document.body.innerHTML = `<div style="color:#fff;padding:20px">Failed to load tour.json: ${err.message}</div>`;
});
