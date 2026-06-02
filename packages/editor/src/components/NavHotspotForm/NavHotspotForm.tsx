import { useTour } from '../../store/tourStore';
import { type NavHotspot } from '../../store/types';
import styles from '../SceneSettings/SceneSettings.module.css';
import formStyles from './NavHotspotForm.module.css';

interface Props {
  hotspot: NavHotspot;
  sceneId: string;
}

const RAD = Math.PI / 180;

export function NavHotspotForm({ hotspot, sceneId }: Props) {
  const { state, dispatch } = useTour();

  function update(patch: Partial<NavHotspot>) {
    dispatch({ type: 'UPDATE_HOTSPOT', sceneId, id: hotspot.id, patch });
  }

  function applyCapture() {
    if (!state.capturedView) return;
    const { yaw, pitch, fov } = state.capturedView;
    update({ targetYaw: yaw, targetPitch: pitch, targetFov: fov });
  }

  const otherScenes = state.tour.scenes.filter((s) => s.id !== sceneId);
  const cv = state.capturedView;

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>Nav Hotspot</div>
      <div className={styles.field}>
        <label className={styles.label}>Target scene</label>
        <select
          className={styles.input}
          value={hotspot.targetSceneId}
          onChange={(e) => update({ targetSceneId: e.target.value })}
        >
          <option value="">— select —</option>
          {otherScenes.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      <div className={styles.sectionTitle}>Arrival direction</div>
      {cv ? (
        <div className={formStyles.captureRow}>
          <span className={formStyles.captureHint}>
            Captured: {(cv.yaw / RAD).toFixed(1)}&deg; / {(cv.pitch / RAD).toFixed(1)}&deg; / {(cv.fov / RAD).toFixed(0)}&deg;
          </span>
          <button className={formStyles.applyBtn} onClick={applyCapture}>
            Apply
          </button>
        </div>
      ) : (
        <div className={formStyles.captureHint}>
          Navigate to target scene, position camera, click &quot;Capture view&quot; on canvas.
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Target Yaw (deg)</label>
        <input
          className={styles.input}
          type="number"
          step="1"
          defaultValue={+(hotspot.targetYaw / RAD).toFixed(2)}
          key={`ty-${hotspot.id}-${hotspot.targetYaw}`}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) update({ targetYaw: v * RAD });
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Target Pitch (deg)</label>
        <input
          className={styles.input}
          type="number"
          step="1"
          defaultValue={+(hotspot.targetPitch / RAD).toFixed(2)}
          key={`tp-${hotspot.id}-${hotspot.targetPitch}`}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) update({ targetPitch: v * RAD });
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Target FOV (deg)</label>
        <input
          className={styles.input}
          type="number"
          step="1"
          defaultValue={+(hotspot.targetFov / RAD).toFixed(2)}
          key={`tf-${hotspot.id}-${hotspot.targetFov}`}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) update({ targetFov: v * RAD });
          }}
        />
      </div>
    </div>
  );
}
