import { NavHotspot } from './hotspots/NavHotspot.js';
import { InfoHotspot } from './hotspots/InfoHotspot.js';
import { TransitionEngine } from './transitions/TransitionEngine.js';

async function init() {
  const tour = await fetch('tour.json').then(r => r.json());

  const viewerEl = document.getElementById('viewer');
  const viewer = new Marzipano.Viewer(viewerEl, {
    controls: { mouseViewMode: 'drag' },
  });

  // scenes: Map<sceneId, { marzipanoScene, data }>
  const scenes = new Map();

  for (const sceneData of tour.scenes) {
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

  // Add hotspots for every scene
  for (const sceneData of tour.scenes) {
    const { marzipanoScene } = scenes.get(sceneData.id);

    for (const hotspot of sceneData.hotspots) {
      if (hotspot.type === 'link') {
        NavHotspot.create(marzipanoScene, hotspot, (h) => {
          engine.navigate(currentSceneId, h);
          currentSceneId = h.targetSceneId;
        });
      } else if (hotspot.type === 'info') {
        InfoHotspot.create(marzipanoScene, hotspot);
      }
    }
  }

  // Show default scene
  const defaultEntry = scenes.get(currentSceneId);
  if (defaultEntry) {
    defaultEntry.marzipanoScene.switchTo();
  }
}

init().catch(err => {
  console.error('panotour: failed to load tour', err);
  document.body.innerHTML = `<div style="color:#fff;padding:20px">Failed to load tour.json: ${err.message}</div>`;
});
