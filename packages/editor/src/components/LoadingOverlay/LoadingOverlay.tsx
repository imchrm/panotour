import styles from './LoadingOverlay.module.css';

export interface LoadingProgress {
  title: string;
  current: number;
  total: number;
  detail?: string;
}

export function LoadingOverlay({ progress }: { progress: LoadingProgress | null }) {
  if (!progress) return null;
  const { title, current, total, detail } = progress;
  const indeterminate = total <= 0;
  const percent = indeterminate ? 0 : Math.min(100, Math.round((current / total) * 100));
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <div className={styles.title}>{title}</div>
        <div className={styles.track}>
          <div
            className={indeterminate ? `${styles.fill} ${styles.indeterminate}` : styles.fill}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className={styles.detail}>
          <span>{detail ?? ''}</span>
          <span>{indeterminate ? '' : `${current} / ${total}`}</span>
        </div>
      </div>
    </div>
  );
}
