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

  // Scroll zoom: +/- FOV on mouse wheel or trackpad pinch-scroll.
  // Cap at 0.15 rad (~8.6°) per event so fast mouse wheel doesn't over-zoom.
  viewerEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const entry = scenes.get(currentSceneId);
    if (!entry) return;
    const view = entry.marzipanoScene.view();
    const px = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
    const delta = Math.sign(px) * Math.min(Math.abs(px) * 0.004, 0.15);
    view.setFov(view.fov() + delta);
  }, { passive: false });
}

init().catch(err => {
  console.error('panotour: failed to load tour', err);
  document.body.innerHTML = `<div style="color:#fff;padding:20px">Failed to load tour.json: ${err.message}</div>`;
});
