import { useEffect, useRef, useState } from 'react';
import { useTour, DEFAULT_FOV } from '../../store/tourStore';
import { isElectron, getElectronApi, getProjectPath, readSceneObjectUrl } from '../../lib/electronApi';
import { panoramaPreviewUrl } from '../../lib/panoramaPreview';
import styles from './PanoramaList.module.css';

function newSceneId(): string {
  return `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface BatchState {
  current: number;
  total: number;
  sceneId: string;
  detail: string;
  detailFull: string;
  fraction: number;
}

function parseTileProgress(chunk: string): { detail: string; full: string; frac: number } | null {
  const text = chunk.split('\r').filter((s) => s.trim()).pop() ?? '';
  const lvl = text.match(/Level (\d+)\/(\d+), face (\d+)\/(\d+)/);
  if (lvl) {
    const [li, lt, f, ft] = [+lvl[1], +lvl[2], +lvl[3], +lvl[4]];
    const levelFrac = (li - 1 + f / ft) / lt;
    const mobile = text.includes('[mobile]');
    return {
      detail: `${li}/${lt} · ${f}/${ft}`,
      full: `Level ${li}/${lt} · face ${f}/${ft}${mobile ? ' (mobile)' : ''}`,
      frac: mobile ? 0.85 + 0.13 * levelFrac : 0.5 + 0.35 * levelFrac,
    };
  }
  const proj = text.match(/Projecting face (\d+)\/(\d+)/);
  if (proj) {
    return {
      detail: `proj ${proj[1]}/${proj[2]}`,
      full: `Projecting face ${proj[1]}/${proj[2]}`,
      frac: 0.5 * (+proj[1] / +proj[2]),
    };
  }
  if (text.includes('preview')) {
    return { detail: 'preview', full: 'Writing preview.jpg', frac: 0.98 };
  }
  return null;
}

export function PanoramaList() {
  const { state, dispatch } = useTour();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [sceneStatus, setSceneStatus] = useState<Record<string, 'tiling' | 'error'>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragArmedId, setDragArmedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const { scenes } = state.tour;
  const selectedIds = scenes.filter((s) => selected[s.id]).map((s) => s.id);
  const allSelected = scenes.length > 0 && selectedIds.length === scenes.length;

  useEffect(() => {
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const s of scenes) next[s.id] = prev[s.id] ?? s.levels.length === 0;
      return next;
    });
  }, [scenes]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && !allSelected;
    }
  }, [selectedIds.length, allSelected]);

  async function handleTileSelected() {
    const api = getElectronApi();
    if (!api || batch) return;
    if (!getProjectPath()) {
      setError('Create or open a project first');
      return;
    }
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setError(null);
    const failures: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const sceneId = ids[i];
      setSceneStatus((m) => ({ ...m, [sceneId]: 'tiling' }));
      setBatch({
        current: i + 1,
        total: ids.length,
        sceneId,
        detail: '',
        detailFull: 'Starting',
        fraction: i / ids.length,
      });
      try {
        const result = await api.tileScene(sceneId, (chunk) => {
          const p = parseTileProgress(chunk);
          if (!p) return;
          setBatch({
            current: i + 1,
            total: ids.length,
            sceneId,
            detail: p.detail,
            detailFull: p.full,
            fraction: (i + p.frac) / ids.length,
          });
        });
        dispatch({
          type: 'UPDATE_SCENE',
          id: sceneId,
          patch: {
            tilesPath: result.tilesPath,
            previewUrl: result.previewUrl,
            levels: result.levels,
          },
        });
        setSceneStatus((m) => {
          const next = { ...m };
          delete next[sceneId];
          return next;
        });
        setSelected((m) => ({ ...m, [sceneId]: false }));
      } catch {
        setSceneStatus((m) => ({ ...m, [sceneId]: 'error' }));
        failures.push(sceneId);
      }
    }
    setBatch(null);
    if (failures.length > 0) {
      setError(`Tiling failed: ${failures.join(', ')}`);
    }
  }

  function toggleAll() {
    const value = !allSelected;
    setSelected((prev) => {
      const next = { ...prev };
      for (const s of scenes) next[s.id] = value;
      return next;
    });
  }

  function addSceneToStore(id: string, title: string, panoramaObjectUrl?: string, originalPath?: string) {
    dispatch({
      type: 'ADD_SCENE',
      scene: {
        id,
        title,
        originalPath,
        tilesPath: `tiles/${id}`,
        previewUrl: `tiles/${id}/preview.jpg`,
        levels: [],
        initialView: { yaw: 0, pitch: 0, fov: DEFAULT_FOV },
        hotspots: [],
        panoramaObjectUrl,
      },
    });
  }

  function handleFiles(files: FileList) {
    Array.from(files).forEach(async (file) => {
      const id = newSceneId();
      addSceneToStore(id, file.name.replace(/\.[^.]+$/, ''), await panoramaPreviewUrl(file), file.name);
    });
  }

  async function handleAddElectron() {
    const api = getElectronApi();
    if (!api || adding) return;
    if (!getProjectPath()) {
      setError('Create or open a project first');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const id = newSceneId();
      const result = await api.addScene(id);
      if (result.canceled) return;
      const objectUrl = await readSceneObjectUrl(id);
      addSceneToStore(id, id, objectUrl, result.originalPath);
    } catch (err: unknown) {
      const message = (err as Error)?.message ?? 'Failed to add scene';
      setError(message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
    } finally {
      setAdding(false);
    }
  }

  function handleAdd() {
    if (isElectron()) {
      handleAddElectron();
    } else {
      fileInputRef.current?.click();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }

  function handleDrop() {
    if (dragId !== null && dropIndex !== null) {
      const from = scenes.findIndex((s) => s.id === dragId);
      const toIndex = from >= 0 && from < dropIndex ? dropIndex - 1 : dropIndex;
      dispatch({ type: 'MOVE_SCENE', id: dragId, toIndex });
    }
    resetDrag();
  }

  function resetDrag() {
    setDragId(null);
    setDragArmedId(null);
    setDropIndex(null);
  }

  function handleDelete(id: string, objectUrl?: string) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    getElectronApi()?.deleteScene(id).catch(() => {});
    dispatch({ type: 'DELETE_SCENE', id });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Scenes</span>
        <button className={styles.addBtn} onClick={handleAdd} disabled={adding}>
          + Add
        </button>
      </div>
      <div className={styles.historyRow}>
        <button
          className={styles.historyBtn}
          onClick={() => dispatch({ type: 'HISTORY_BACK' })}
          disabled={state.historyIndex <= 0}
          title="Previous scene"
        >
          &#8592;
        </button>
        <button
          className={styles.historyBtn}
          onClick={() => dispatch({ type: 'HISTORY_FORWARD' })}
          disabled={state.historyIndex >= state.sceneHistory.length - 1}
          title="Next scene"
        >
          &#8594;
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleInputChange}
      />
      {isElectron() && scenes.length > 0 && (
        <div className={styles.tileControls}>
          <button
            className={styles.tileAllBtn}
            onClick={handleTileSelected}
            disabled={!!batch || selectedIds.length === 0}
          >
            {batch ? 'Tiling…' : `Tile selected (${selectedIds.length})`}
          </button>
          {batch && (
            <div
              className={styles.progressWrap}
              title={`Scene ${batch.current}/${batch.total} · ${batch.detailFull}`}
            >
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.round(batch.fraction * 100)}%` }}
                />
              </div>
              <div className={styles.progressText}>
                {batch.current}/{batch.total}
                {batch.detail ? ` · ${batch.detail}` : ''}
              </div>
            </div>
          )}
          <label className={styles.selectAllRow}>
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={!!batch}
            />
            Select all
          </label>
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}
      <ul className={styles.list}>
        {scenes.length === 0 && (
          <li className={styles.empty}>
            {isElectron() && !getProjectPath()
              ? 'Create or open a project to start.'
              : 'No scenes. Add a panorama to start.'}
          </li>
        )}
        {scenes.map((scene, index) => {
          const isDefault = state.tour.defaultSceneId === scene.id;
          const status = sceneStatus[scene.id];
          const tiled = scene.levels.length > 0;
          const dropClass =
            dropIndex === index
              ? styles.dropBefore
              : dropIndex === index + 1 && index === scenes.length - 1
                ? styles.dropAfter
                : '';
          return (
            <li
              key={scene.id}
              className={`${styles.item} ${state.activeSceneId === scene.id ? styles.active : ''} ${
                dragId === scene.id ? styles.dragging : ''
              } ${dropClass}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_SCENE', id: scene.id })}
              draggable={dragArmedId === scene.id}
              onDragStart={(e) => {
                if (dragArmedId !== scene.id) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.effectAllowed = 'move';
                setDragId(scene.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = e.currentTarget.getBoundingClientRect();
                const before = e.clientY < rect.top + rect.height / 2;
                setDropIndex(index + (before ? 0 : 1));
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop();
              }}
              onDragEnd={resetDrag}
            >
              <span
                className={styles.dragHandle}
                title="Drag to reorder"
                onPointerDown={() => setDragArmedId(scene.id)}
                onPointerUp={() => { if (!dragId) setDragArmedId(null); }}
                onClick={(e) => e.stopPropagation()}
              />
              {isElectron() && (
                <input
                  type="checkbox"
                  className={styles.itemCheck}
                  checked={selected[scene.id] ?? false}
                  disabled={!!batch}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() =>
                    setSelected((m) => ({ ...m, [scene.id]: !m[scene.id] }))
                  }
                />
              )}
              {status === 'tiling' ? (
                <span className={styles.spinner} title="Tiling…" />
              ) : status === 'error' ? (
                <span className={`${styles.dot} ${styles.dotError}`} title="Tiling failed" />
              ) : tiled ? (
                <span className={styles.tiledMark} title={`Tiled: ${scene.levels.length} levels`}>
                  <span className={`${styles.dot} ${styles.dotTiled}`} />
                  <span className={styles.levelsBadge}>{scene.levels.length}L</span>
                </span>
              ) : (
                <span className={styles.dot} title="Not tiled" />
              )}
              <button
                className={`${styles.starBtn} ${isDefault ? styles.starActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'SET_DEFAULT_SCENE', id: scene.id });
                }}
                title={isDefault ? 'Default scene' : 'Set as default scene'}
              >
                {isDefault ? '★' : '☆'}
              </button>
              <span
                className={styles.itemTitle}
                title={scene.originalPath ?? `scenes/${scene.id}.jpg`}
              >
                {scene.title}
              </span>
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(scene.id, scene.panoramaObjectUrl);
                }}
                title="Delete scene"
              >
                &times;
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
