import { useTour } from '../../store/tourStore';
import { type NavHotspot, type InfoHotspot } from '../../store/types';
import { NavHotspotForm } from '../NavHotspotForm/NavHotspotForm';
import { InfoHotspotForm } from '../InfoHotspotForm/InfoHotspotForm';
import styles from './HotspotPanel.module.css';

export function HotspotPanel() {
  const { state, dispatch } = useTour();
  const activeScene = state.tour.scenes.find((s) => s.id === state.activeSceneId);

  if (!activeScene) return null;

  const activeHotspot = activeScene.hotspots.find((h) => h.id === state.activeHotspotId);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Hotspots</span>
        <div className={styles.headerActions}>
          <button
            className={styles.addBtn}
            onClick={() => dispatch({ type: 'START_PLACING_HOTSPOT', hotspotType: 'link' })}
            title="Add navigation hotspot"
          >
            + Nav
          </button>
          <button
            className={styles.addBtn}
            onClick={() => dispatch({ type: 'START_PLACING_HOTSPOT', hotspotType: 'info' })}
            title="Add info hotspot"
          >
            + Info
          </button>
        </div>
      </div>
      <div className={styles.flipRow}>
        <label className={styles.flipLabel}>
          <input
            type="checkbox"
            checked={state.flipArrivalYaw}
            onChange={() => dispatch({ type: 'TOGGLE_FLIP_ARRIVAL_YAW' })}
          />
          &nbsp;Auto-flip arrival yaw (+180&deg;)
        </label>
      </div>
      <ul className={styles.list}>
        {activeScene.hotspots.length === 0 && (
          <li className={styles.empty}>No hotspots. Click + to place one.</li>
        )}
        {activeScene.hotspots.map((hotspot) => (
          <li
            key={hotspot.id}
            className={`${styles.item} ${state.activeHotspotId === hotspot.id ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_HOTSPOT', id: hotspot.id })}
          >
            <span className={styles.typeIcon}>{hotspot.type === 'link' ? '→' : 'ℹ'}</span>
            <span className={styles.itemId}>{hotspot.id}</span>
            <button
              className={styles.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'DELETE_HOTSPOT', sceneId: activeScene.id, id: hotspot.id });
              }}
              title="Delete hotspot"
            >
              &times;
            </button>
          </li>
        ))}
      </ul>
      {activeHotspot && activeHotspot.type === 'link' && (
        <NavHotspotForm hotspot={activeHotspot as NavHotspot} sceneId={activeScene.id} />
      )}
      {activeHotspot && activeHotspot.type === 'info' && (
        <InfoHotspotForm hotspot={activeHotspot as InfoHotspot} sceneId={activeScene.id} />
      )}
    </div>
  );
}
