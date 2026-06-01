import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { TourData } from '../store/types';

const TOUR_JSON_INDENT = 2;

/** Direct download of tour.json — no ZIP, no JSZip required. */
export function downloadTourJson(tour: TourData): void {
  const json = JSON.stringify(tour, null, TOUR_JSON_INDENT);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, 'tour.json');
}

/**
 * Build and download a ZIP archive.
 *
 * Current contents:
 *   tour.json — the tour data
 *
 * When packages/viewer is implemented, add viewer static files here:
 *   index.html, app.js, style.css, marzipano.js,
 *   transitions/*, hotspots/*
 * Fetch them from /viewer/* (configure Vite to serve packages/viewer/).
 */
export async function downloadZip(tour: TourData, zipName = 'tour.zip'): Promise<void> {
  const zip = new JSZip();

  zip.file('tour.json', JSON.stringify(tour, null, TOUR_JSON_INDENT));

  // Viewer files placeholder — uncomment and extend after packages/viewer lands:
  // const viewerFiles = ['index.html', 'app.js', 'style.css', 'marzipano.js'];
  // for (const f of viewerFiles) {
  //   const res = await fetch(`/viewer/${f}`);
  //   zip.file(f, await res.blob());
  // }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(blob, zipName);
}
