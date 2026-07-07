import { Component, type ReactNode } from 'react';
import styles from './PanoramaCanvas.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.wrapper}>
          <div className={styles.placeholder}>
            <div>Panorama canvas crashed: {this.state.error.message}</div>
            <button
              className={styles.captureBtn}
              onClick={() => this.setState({ error: null })}
            >
              Reload canvas
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
