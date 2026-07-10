import { useEffect, useState } from 'react';
import { useTour } from '../../store/tourStore';
import type { TourData } from '../../store/types';
import { exportTour } from '../../lib/exporter';
import { downloadTourJson, downloadZip, exportToFolder, hasFolderExport } from '../../lib/zipper';
import { isElectron, getElectronApi } from '../../lib/electronApi';
import styles from './ExportButton.module.css';

interface ExportIssue {
  sceneTitle: string;
  hotspotId: string;
  kind: 'arrival' | 'target';
}

export function ExportButton() {
  const { state } = useTour();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: 'zip' | 'folder'; issues: ExportIssue[] } | null>(null);

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

  function collectIssues(): ExportIssue[] {
    const issues: ExportIssue[] = [];
    for (const scene of state.tour.scenes) {
      for (const h of scene.hotspots) {
        if (h.type !== 'link') continue;
        if (!h.targetSceneId || !state.tour.scenes.some((s) => s.id === h.targetSceneId)) {
          issues.push({ sceneTitle: scene.title, hotspotId: h.id, kind: 'target' });
        } else if (!h.arrivalSet) {
          issues.push({ sceneTitle: scene.title, hotspotId: h.id, kind: 'arrival' });
        }
      }
    }
    return issues;
  }

  function requestExport(kind: 'zip' | 'folder') {
    if (disabled || busy) return;
    setError(null);
    const issues = collectIssues();
    if (issues.length > 0) {
      setPending({ kind, issues });
      return;
    }
    runExport(kind);
  }

  function runExport(kind: 'zip' | 'folder') {
    setPending(null);
    if (kind === 'zip') handleZip();
    else handleFolder();
  }

  const handleJson = () => {
    if (disabled) return;
    setError(null);
    setPending(null);
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
          onClick={() => requestExport('zip')}
          disabled={disabled || busy}
          title="Download ZIP archive"
        >
          {busy ? '…' : '↓ ZIP'}
        </button>
        <button
          className={styles.btn}
          onClick={() => requestExport('folder')}
          disabled={disabled || busy}
          title={hasFolderExport() ? 'Export to folder' : 'Export to folder (ZIP fallback)'}
        >
          {busy ? '…' : '→ Folder'}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {pending && (
        <div className={styles.confirm}>
          <div className={styles.confirmTitle}>
            {pending.issues.length} nav hotspot(s) need attention:
          </div>
          <ul className={styles.confirmList}>
            {pending.issues.slice(0, 6).map((issue) => (
              <li key={issue.hotspotId}>
                <b>{issue.sceneTitle}</b> — {issue.hotspotId.slice(0, 18)}…{' '}
                {issue.kind === 'target' ? 'target scene missing' : 'arrival direction not set'}
              </li>
            ))}
            {pending.issues.length > 6 && <li>…and {pending.issues.length - 6} more</li>}
          </ul>
          <div className={styles.confirmActions}>
            <button className={styles.btn} onClick={() => runExport(pending.kind)}>
              Export anyway
            </button>
            <button className={styles.btn} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
