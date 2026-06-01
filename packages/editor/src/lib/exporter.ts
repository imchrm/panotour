import type { TourData, Scene } from '../store/types';
import type { EditorScene } from '../store/tourStore';

interface EditorTour {
  version: string;
  defaultSceneId: string;
  scenes: EditorScene[];
}

/**
 * Strip editor-only fields (panoramaObjectUrl) and return a clean TourData
 * ready to be serialised as tour.json.
 */
export function exportTour(tour: EditorTour): TourData {
  const scenes: Scene[] = tour.scenes.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ panoramaObjectUrl: _url, ...scene }) => scene
  );
  return { version: tour.version, defaultSceneId: tour.defaultSceneId, scenes };
}
