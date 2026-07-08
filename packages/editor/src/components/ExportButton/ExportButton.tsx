import { useEffect, useState } from 'react';
import { useTour } from '../../store/tourStore';
import type { TourData } from '../../store/types';
import { exportTour } from '../../lib/exporter';
import { downloadTourJson, downloadZip, exportToFolder, hasFolderExport } from '../../lib/zipper';
import { isElectron, getElectronApi } from '../../lib/electronApi';
import styles from './ExportButton.module.css';

export function ExportButton() {
  const { state } = useTour();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = state.tour.scenes.length === 0;

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  function tiledTour(): TourData | null {
    const full = exportTour(state.tour);
    const scenes = full.scenes.filter((s) => s.levels.length > 0);
    const skipped = full.scenes.length - scenes.length;
    if (scenes.length === 0) {
      setError('No tiled scenes — run Tile on each scene first');
      return null;
    }
    if (skipped > 0) {
      setError(`Skipped ${skipped} untiled scene(s) — run Tile to include them`);
    }
    const defaultSceneId = scenes.some((s) => s.id === full.defaultSceneId)
      ? full.defaultSceneId
      : scenes[0].id;
    return { ...full, defaultSceneId, scenes };
  }

  const handleJson = () => {
    if (disabled) return;
    setError(null);
    downloadTourJson(exportTour(state.tour));
  };

  const handleZip = async () => {
    if (disabled || busy) return;
    setError(null);
    const tour = tiledTour();
    if (!tour) return;
    setBusy(true);
    try {
      const api = getElectronApi();
      if (api) {
        await api.exportZip(tour);
      } else {
        await downloadZip(tour);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFolder = async () => {
    if (disabled || busy) return;
    setError(null);
    const tour = tiledTour();
    if (!tour) return;
    setBusy(true);
    try {
      const api = getElectronApi();
      if (api) {
        await api.exportFolder(tour);
      } else {
        await exportToFolder(tour);
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError((err as Error)?.message ?? 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (disabled || busy) return;
    setError(null);
    const tour = tiledTour();
    if (!tour) return;
    setBusy(true);
    try {
      const activeIncluded = tour.scenes.some((s) => s.id === state.activeSceneId);
      await getElectronApi()?.openPreview(tour, {
        sceneId: activeIncluded ? state.activeSceneId ?? undefined : undefined,
      });
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        {isElectron() && (
          <button
            className={styles.btn}
            onClick={handlePreview}
            disabled={disabled || busy}
            title="Open tour preview"
          >
            ▶ Preview
          </button>
        )}
        <button
          className={styles.btn}
          onClick={handleJson}
          disabled={disabled}
          title="Download tour.json"
        >
          ↓ tour.json
        </button>
        <button
          className={styles.btn}
          onClick={handleZip}
          disabled={disabled || busy}
          title="Download ZIP archive"
        >
          {busy ? '…' : '↓ ZIP'}
        </button>
        <button
          className={styles.btn}
          onClick={handleFolder}
          disabled={disabled || busy}
          title={hasFolderExport() ? 'Export to folder' : 'Export to folder (ZIP fallback)'}
        >
          {busy ? '…' : '→ Folder'}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
