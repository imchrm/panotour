import { useState } from 'react';
import { useTour } from '../../store/tourStore';
import { exportTour } from '../../lib/exporter';
import { downloadTourJson, downloadZip } from '../../lib/zipper';
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
    </div>
  );
}
