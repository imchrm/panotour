import { useState } from 'react';
import { useTour } from '../../store/tourStore';
import { type InfoHotspot, type InfoContent } from '../../store/types';
import { isElectron, getElectronApi } from '../../lib/electronApi';
import styles from '../SceneSettings/SceneSettings.module.css';
import formStyles from './InfoHotspotForm.module.css';

interface Props {
  hotspot: InfoHotspot;
  sceneId: string;
}

export function InfoHotspotForm({ hotspot, sceneId }: Props) {
  const { dispatch } = useTour();
  const [error, setError] = useState<string | null>(null);

  function updateContent(patch: Partial<InfoContent>) {
    dispatch({
      type: 'UPDATE_HOTSPOT',
      sceneId,
      id: hotspot.id,
      patch: { content: { ...hotspot.content, ...patch } },
    });
  }

  async function browseMedia(kind: 'image' | 'video') {
    const api = getElectronApi();
    if (!api) return;
    setError(null);
    try {
      const result = await api.copyMedia({ kind });
      if (result.canceled || !result.mediaPath) return;
      if (kind === 'image') updateContent({ imageUrl: result.mediaPath });
      else updateContent({ videoUrl: result.mediaPath });
    } catch (err: unknown) {
      const message = (err as Error)?.message ?? 'Failed to copy media';
      setError(message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
    }
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
        <div className={formStyles.mediaRow}>
          <input
            className={styles.input}
            type="text"
            value={hotspot.content.imageUrl ?? ''}
            onChange={(e) => updateContent({ imageUrl: e.target.value })}
          />
          {isElectron() && (
            <button
              className={formStyles.browseBtn}
              onClick={() => browseMedia('image')}
              title="Copy an image file into the project media folder"
            >
              Browse
            </button>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Video URL</label>
        <div className={formStyles.mediaRow}>
          <input
            className={styles.input}
            type="text"
            value={hotspot.content.videoUrl ?? ''}
            onChange={(e) => updateContent({ videoUrl: e.target.value })}
            placeholder="media/*.mp4 or YouTube embed URL"
          />
          {isElectron() && (
            <button
              className={formStyles.browseBtn}
              onClick={() => browseMedia('video')}
              title="Copy a video file into the project media folder"
            >
              Browse
            </button>
          )}
        </div>
      </div>
      {error && <div className={formStyles.error}>{error}</div>}
    </div>
  );
}
