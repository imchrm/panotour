import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { TourData } from '../store/types';

const TOUR_JSON_INDENT = 2;

const VIEWER_FILES = [
  'index.html',
  'app.js',
  'i18n.js',
  'style.css',
  'marzipano.js',
  'hotspots/NavHotspot.js',
  'hotspots/InfoHotspot.js',
  'hotspots/InfoPanel.js',
  'transitions/TransitionEngine.js',
  'transitions/easing.js',
];

async function fetchViewerBlob(file: string): Promise<Blob> {
  const res = await fetch(`/viewer/${file}`);
  if (!res.ok) throw new Error(`Failed to fetch viewer file: ${file} (${res.status})`);
  return res.blob();
}

async function addViewerFiles(zip: JSZip): Promise<void> {
  await Promise.all(
    VIEWER_FILES.map(async (file) => {
      zip.file(file, await fetchViewerBlob(file));
    })
  );
}

async function writeToDir(
  dir: FileSystemDirectoryHandle,
  filePath: string,
  data: string | ArrayBuffer,
): Promise<void> {
  const parts = filePath.split('/');
  let current = dir;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  const fileHandle = await current.getFileHandle(parts.at(-1)!, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

export function hasFolderExport(): boolean {
  return typeof window.showDirectoryPicker === 'function';
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

export async function exportToFolder(tour: TourData): Promise<void> {
  if (!hasFolderExport()) {
    await downloadZip(tour);
    return;
  }

  // Throws AbortError if user cancels — caller should handle it
  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

  await writeToDir(dirHandle, 'tour.json', JSON.stringify(tour, null, TOUR_JSON_INDENT));

  await Promise.all(
    VIEWER_FILES.map(async (file) => {
      const res = await fetch(`/viewer/${file}`);
      if (!res.ok) throw new Error(`Failed to fetch viewer file: ${file} (${res.status})`);
      await writeToDir(dirHandle, file, await res.arrayBuffer());
    })
  );
}
