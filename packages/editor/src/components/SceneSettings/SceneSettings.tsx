import { useEffect, useRef, useState } from 'react';
import { useTour } from '../../store/tourStore';
import type { TileLevel } from '../../store/types';
import { checkServer, tileOnServer, SERVER_URL } from '../../lib/serverApi';
import styles from './SceneSettings.module.css';

const RAD = Math.PI / 180;

export function SceneSettings() {
  const { state, dispatch } = useTour();
  const activeScene = state.tour.scenes.find((s) => s.id === state.activeSceneId);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [tiling, setTiling]     = useState(false);
  const [tileMsg, setTileMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    checkServer().then((ok) => { if (alive) setServerOk(ok); });
    return () => { alive = false; };
  }, []);

  if (!activeScene) return null;

  function updateTitle(title: string) {
    if (!activeScene) return;
    dispatch({ type: 'UPDATE_SCENE', id: activeScene.id, patch: { title } });
  }

  function updateTilesPath(tilesPath: string) {
    if (!activeScene) return;
    dispatch({
      type: 'UPDATE_SCENE',
      id: activeScene.id,
      patch: { tilesPath, previewUrl: `${tilesPath}/preview.jpg` },
    });
  }

  function setDefault() {
    if (!activeScene) return;
    dispatch({ type: 'SET_DEFAULT_SCENE', id: activeScene.id });
  }

  function updateView(field: 'yaw' | 'pitch' | 'fov', deg: string) {
    if (!activeScene) return;
    const rad = parseFloat(deg) * RAD;
    if (isNaN(rad)) return;
    dispatch({
      type: 'UPDATE_SCENE',
      id: activeScene.id,
      patch: { initialView: { ...activeScene.initialView, [field]: rad } },
    });
  }

  async function handleTile() {
    if (!activeScene?.panoramaObjectUrl) return;
    setTiling(true);
    setTileMsg(null);
    try {
      const result = await tileOnServer(activeScene.panoramaObjectUrl, activeScene.id);
      dispatch({
        type: 'UPDATE_SCENE',
        id: activeScene.id,
        patch: {
          tilesPath:  result.tilesPath,
          previewUrl: result.previewUrl,
          levels:     result.levels,
        },
      });
      setTileMsg({ ok: true, text: `${result.levels.length} levels — done` });
    } catch (err: unknown) {
      setTileMsg({ ok: false, text: err instanceof Error ? err.message : 'Tiling failed' });
    } finally {
      setTiling(false);
    }
  }

  function handleManifestFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const manifest = JSON.parse(e.target?.result as string) as {
          sceneId?: string;
          id?: string;
          levels: TileLevel[];
        };
        const sceneId = manifest.sceneId ?? manifest.id;
        if (!activeScene || !sceneId || !Array.isArray(manifest.levels)) return;
        dispatch({
          type: 'UPDATE_SCENE',
          id: activeScene.id,
          patch: {
            tilesPath: `tiles/${sceneId}`,
            previewUrl: `tiles/${sceneId}/preview.jpg`,
            levels: manifest.levels,
          },
        });
      } catch {
        // malformed JSON — ignore
      }
    };
    reader.readAsText(file);
  }

  const { yaw, pitch, fov } = activeScene.initialView;
  const levelsOk = activeScene.levels.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>Scene</div>
      <div className={styles.field}>
        <label className={styles.label}>Title</label>
        <input
          className={styles.input}
          type="text"
          value={activeScene.title}
          onChange={(e) => updateTitle(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={state.tour.defaultSceneId === activeScene.id}
            onChange={setDefault}
          />
          Default scene
        </label>
      </div>

      <div className={styles.sectionTitle}>Tiles</div>

      {/* Server tiling */}
      {activeScene.panoramaObjectUrl && (
        <div className={styles.field}>
          <button
            className={styles.tileBtn}
            onClick={handleTile}
            disabled={tiling || serverOk === false}
            title={
              serverOk === false
                ? `Server not running — start with: npm run server  (${SERVER_URL})`
                : 'Tile panorama on local server and auto-fill levels'
            }
          >
            {tiling ? 'Tiling…' : 'Tile on server ▶'}
          </button>
          <div className={
            serverOk === true  ? styles.serverOk   :
            serverOk === false ? styles.serverWarn :
            styles.levelsWarn
          }>
            {serverOk === true  ? `Server ready (${SERVER_URL})` :
             serverOk === false ? `Server offline — npm run server` :
             'Checking server…'}
          </div>
          {tileMsg && (
            <div className={tileMsg.ok ? styles.levelsOk : styles.levelsWarn}>
              {tileMsg.text}
            </div>
          )}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Tiles path</label>
        <input
          className={styles.input}
          type="text"
          value={activeScene.tilesPath}
          onChange={(e) => updateTilesPath(e.target.value)}
          placeholder="tiles/scene-01"
        />
      </div>
      <div className={styles.field}>
        <button
          className={styles.manifestBtn}
          onClick={() => manifestInputRef.current?.click()}
          title="Load manifest.json generated by tiler to fill tiles path and levels"
        >
          Load manifest.json
        </button>
        <input
          ref={manifestInputRef}
          type="file"
          accept=".json,application/json"
          className={styles.hiddenInput}
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleManifestFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />
        {levelsOk ? (
          <div className={styles.levelsOk}>
            {activeScene.levels.length} levels loaded
          </div>
        ) : (
          <div className={styles.levelsWarn}>
            No levels — load manifest.json
          </div>
        )}
      </div>

      <div className={styles.sectionTitle}>Initial View</div>
      <div className={styles.field}>
        <label className={styles.label}>Yaw (deg)</label>
        <input
          className={styles.input}
          type="number"
          step="1"
          defaultValue={+(yaw / RAD).toFixed(2)}
          key={`yaw-${activeScene.id}`}
          onBlur={(e) => updateView('yaw', e.target.value)}
          onChange={(e) => updateView('yaw', e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Pitch (deg)</label>
        <input
          className={styles.input}
          type="number"
          step="1"
          defaultValue={+(pitch / RAD).toFixed(2)}
          key={`pitch-${activeScene.id}`}
          onBlur={(e) => updateView('pitch', e.target.value)}
          onChange={(e) => updateView('pitch', e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>FOV (deg)</label>
        <input
          className={styles.input}
          type="number"
          step="1"
          defaultValue={+(fov / RAD).toFixed(2)}
          key={`fov-${activeScene.id}`}
          onBlur={(e) => updateView('fov', e.target.value)}
          onChange={(e) => updateView('fov', e.target.value)}
        />
      </div>
    </div>
  );
}
