import { useRef } from 'react';
import { useTour, DEFAULT_FOV } from '../../store/tourStore';
import styles from './PanoramaList.module.css';

export function PanoramaList() {
  const { state, dispatch } = useTour();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList) {
    Array.from(files).forEach((file) => {
      const id = `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const panoramaObjectUrl = URL.createObjectURL(file);
      const title = file.name.replace(/\.[^.]+$/, '');
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
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }

  function handleDelete(id: string, objectUrl?: string) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    dispatch({ type: 'DELETE_SCENE', id });
  }

  const { scenes } = state.tour;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Scenes</span>
        <button className={styles.addBtn} onClick={() => fileInputRef.current?.click()}>
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
      <ul className={styles.list}>
        {scenes.length === 0 && (
          <li className={styles.empty}>No scenes. Add a panorama to start.</li>
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
