import { useTour } from '../../store/tourStore';
import styles from './SceneSettings.module.css';

const RAD = Math.PI / 180;

export function SceneSettings() {
  const { state, dispatch } = useTour();
  const activeScene = state.tour.scenes.find((s) => s.id === state.activeSceneId);

  if (!activeScene) return null;

  function updateTitle(title: string) {
    if (!activeScene) return;
    dispatch({ type: 'UPDATE_SCENE', id: activeScene.id, patch: { title } });
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

  const { yaw, pitch, fov } = activeScene.initialView;

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
