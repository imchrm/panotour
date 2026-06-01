import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { TourData } from '../store/types';

const TOUR_JSON_INDENT = 2;

const VIEWER_FILES = [
  'index.html',
  'app.js',
  'style.css',
  'marzipano.js',
  'hotspots/NavHotspot.js',
  'hotspots/InfoHotspot.js',
  'hotspots/InfoPanel.js',
  'transitions/TransitionEngine.js',
  'transitions/easing.js',
];

async function addViewerFiles(zip: JSZip): Promise<void> {
  await Promise.all(
    VIEWER_FILES.map(async (file) => {
      const res = await fetch(`/viewer/${file}`);
      if (!res.ok) throw new Error(`Failed to fetch viewer file: ${file} (${res.status})`);
      zip.file(file, await res.blob());
    })
  );
}

export function downloadTourJson(tour: TourData): void {
  const json = JSON.stringify(tour, null, TOUR_JSON_INDENT);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, 'tour.json');
}

export async function downloadZip(tour: TourData, zipName = 'tour.zip'): Promise<void> {
  const zip = new JSZip();

  zip.file('tour.json', JSON.stringify(tour, null, TOUR_JSON_INDENT));
  await addViewerFiles(zip);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(blob, zipName);
}
