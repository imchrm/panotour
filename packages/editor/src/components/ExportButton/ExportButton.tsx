import { useState } from 'react';
import { useTour } from '../../store/tourStore';
import { exportTour } from '../../lib/exporter';
import { downloadTourJson, downloadZip, exportToFolder, hasFolderExport } from '../../lib/zipper';
import { isElectron, getElectronApi } from '../../lib/electronApi';
import styles from './ExportButton.module.css';

export function ExportButton() {
  const { state } = useTour();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = state.tour.scenes.length === 0;

  const handleJson = () => {
    if (disabled) return;
    setError(null);
    downloadTourJson(exportTour(state.tour));
  };

  const handleZip = async () => {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const api = getElectronApi();
      if (api) {
        await api.exportZip(exportTour(state.tour));
      } else {
        await downloadZip(exportTour(state.tour));
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFolder = async () => {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const api = getElectronApi();
      if (api) {
        await api.exportFolder(exportTour(state.tour));
      } else {
        await exportToFolder(exportTour(state.tour));
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
    setBusy(true);
    setError(null);
    try {
      await getElectronApi()?.openPreview(exportTour(state.tour), {
        sceneId: state.activeSceneId ?? undefined,
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
