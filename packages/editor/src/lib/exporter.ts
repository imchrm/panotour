import type { TourData, Scene, Hotspot } from '../store/types';
import type { EditorScene } from '../store/tourStore';

interface EditorTour {
  version: string;
  defaultSceneId: string;
  scenes: EditorScene[];
}

/**
 * Strip editor-only fields (panoramaObjectUrl, originalPath, arrivalSet) and
 * return a clean TourData ready to be serialised as tour.json.
 */
export function exportTour(tour: EditorTour): TourData {
  const scenes: Scene[] = tour.scenes.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ panoramaObjectUrl: _url, originalPath: _path, ...scene }) => ({
      ...scene,
      hotspots: scene.hotspots.map((h): Hotspot => {
        if (h.type !== 'link') return h;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { arrivalSet: _set, ...nav } = h;
        return nav;
      }),
    })
  );
  return { version: tour.version, defaultSceneId: tour.defaultSceneId, scenes };
}
