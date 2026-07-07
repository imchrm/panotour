import { useRef, useState } from 'react';
import { useTour, DEFAULT_FOV } from '../../store/tourStore';
import { isElectron, getElectronApi, getProjectPath, readSceneObjectUrl } from '../../lib/electronApi';
import styles from './PanoramaList.module.css';

function newSceneId(): string {
  return `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PanoramaList() {
  const { state, dispatch } = useTour();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSceneToStore(id: string, title: string, panoramaObjectUrl?: string) {
    dispatch({
      type: 'ADD_SCENE',
      scene: {
        id,
        title,
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
    Array.from(files).forEach((file) => {
      const id = newSceneId();
      addSceneToStore(id, file.name.replace(/\.[^.]+$/, ''), URL.createObjectURL(file));
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
      addSceneToStore(id, id, objectUrl);
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

  function handleDelete(id: string, objectUrl?: string) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    getElectronApi()?.deleteScene(id).catch(() => {});
    dispatch({ type: 'DELETE_SCENE', id });
  }

  const { scenes } = state.tour;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Scenes</span>
        <button className={styles.addBtn} onClick={handleAdd} disabled={adding}>
          + Add
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
      {error && <div className={styles.error}>{error}</div>}
      <ul className={styles.list}>
        {scenes.length === 0 && (
          <li className={styles.empty}>
            {isElectron() && !getProjectPath()
              ? 'Create or open a project to start.'
              : 'No scenes. Add a panorama to start.'}
          </li>
        )}
        {scenes.map((scene) => {
          const isDefault = state.tour.defaultSceneId === scene.id;
          return (
            <li
              key={scene.id}
              className={`${styles.item} ${state.activeSceneId === scene.id ? styles.active : ''}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_SCENE', id: scene.id })}
            >
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
              <span className={styles.itemTitle}>{scene.title}</span>
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
