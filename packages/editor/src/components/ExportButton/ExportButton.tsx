import { useState } from 'react';
import { useTour } from '../../store/tourStore';
import { exportTour } from '../../lib/exporter';
import { downloadTourJson, downloadZip, exportToFolder, hasFolderExport } from '../../lib/zipper';
import styles from './ExportButton.module.css';

export function ExportButton() {
  const { state } = useTour();
  const [busy, setBusy] = useState(false);

  const disabled = state.tour.scenes.length === 0;

  const handleJson = () => {
    if (disabled) return;
    downloadTourJson(exportTour(state.tour));
  };

  const handleZip = async () => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await downloadZip(exportTour(state.tour));
    } finally {
      setBusy(false);
    }
  };

  const handleFolder = async () => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await exportToFolder(exportTour(state.tour));
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'AbortError') throw err;
      // user cancelled picker — do nothing
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.group}>
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
  );
}
