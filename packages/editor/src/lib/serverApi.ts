import type { TileLevel } from '../store/types';

// Override default server URL via VITE_TILER_SERVER env var in .env.local
export const SERVER_URL: string =
  (import.meta.env.VITE_TILER_SERVER as string | undefined) ?? 'http://localhost:3333';

export interface TileResult {
  sceneId:     string;
  tilesPath:   string;   // relative, e.g. "tiles/scene-01"
  previewUrl:  string;
  levels:      TileLevel[];
  mobileLevels?: TileLevel[];
}

/**
 * Ping the tiling server.
 * Returns true if reachable, false otherwise.
 */
export async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upload a panorama blob to the server and tile it.
 * Uses the Object URL stored in EditorScene.panoramaObjectUrl.
 */
export async function tileOnServer(
  panoramaObjectUrl: string,
  sceneId: string,
  mobile = false,
): Promise<TileResult> {
  // Fetch the panorama from its blob Object URL
  const blob = await fetch(panoramaObjectUrl).then((r) => {
    if (!r.ok) throw new Error('Failed to read panorama from Object URL');
    return r.blob();
  });

  const form = new FormData();
  form.append('panorama', blob, `${sceneId}.jpg`);
  form.append('sceneId', sceneId);
  if (mobile) form.append('mobile', '1');

  const res = await fetch(`${SERVER_URL}/api/tile`, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
  return body as TileResult;
}

/**
 * Return the list of all tile file paths for a scene.
 * Used by the zipper to include tiles in ZIP export.
 */
export async function fetchTileFiles(sceneId: string): Promise<string[]> {
  const res = await fetch(`${SERVER_URL}/api/tile/${encodeURIComponent(sceneId)}/files`);
  if (!res.ok) return [];
  const { files } = await res.json();
  return files as string[];
}
