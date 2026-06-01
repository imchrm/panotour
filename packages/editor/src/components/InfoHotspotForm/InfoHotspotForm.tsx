import { useTour } from '../../store/tourStore';
import { type InfoHotspot, type InfoContent } from '../../store/types';
import styles from '../SceneSettings/SceneSettings.module.css';

interface Props {
  hotspot: InfoHotspot;
  sceneId: string;
}

export function InfoHotspotForm({ hotspot, sceneId }: Props) {
  const { dispatch } = useTour();

  function updateContent(patch: Partial<InfoContent>) {
    dispatch({
      type: 'UPDATE_HOTSPOT',
      sceneId,
      id: hotspot.id,
      patch: { content: { ...hotspot.content, ...patch } },
    });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>Info Hotspot</div>
      <div className={styles.field}>
        <label className={styles.label}>Title</label>
        <input
          className={styles.input}
          type="text"
          value={hotspot.content.title}
          onChange={(e) => updateContent({ title: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Text</label>
        <textarea
          className={styles.input}
          rows={3}
          value={hotspot.content.text ?? ''}
          onChange={(e) => updateContent({ text: e.target.value })}
          style={{ resize: 'vertical' }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Image URL</label>
        <input
          className={styles.input}
          type="text"
          value={hotspot.content.imageUrl ?? ''}
          onChange={(e) => updateContent({ imageUrl: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Video URL</label>
        <input
          className={styles.input}
          type="text"
          value={hotspot.content.videoUrl ?? ''}
          onChange={(e) => updateContent({ videoUrl: e.target.value })}
        />
      </div>
    </div>
  );
}
