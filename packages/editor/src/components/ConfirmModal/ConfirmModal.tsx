import { useEffect, type ReactNode } from 'react';
import styles from './ConfirmModal.module.css';

interface Props {
  text: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ text, confirmLabel, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <div className={styles.text}>{text}</div>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={onCancel}>
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
