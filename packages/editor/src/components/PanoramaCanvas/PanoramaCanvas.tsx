import { useEffect, useRef, useState } from 'react';
import Marzipano from 'marzipano';
import { useTour } from '../../store/tourStore';
import styles from './PanoramaCanvas.module.css';

const RAD = Math.PI / 180;

export function PanoramaCanvas() {
  const { state, dispatch } = useTour();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const viewRef = useRef<any>(null);
  const hotspotHandlesRef = useRef<any[]>([]);
  const [viewInfo, setViewInfo] = useState<{ yaw: number; pitch: number; fov: number } | null>(null);

  const activeScene = state.tour.scenes.find((s) => s.id === state.activeSceneId);

  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = new Marzipano.Viewer(containerRef.current, {
      controls: { mouseViewMode: 'drag' },
    });
    viewerRef.current = viewer;
    return () => {
      viewer.destroy();
      viewerRef.current = null;
      sceneRef.current = null;
      viewRef.current = null;
    };
  }, []);

  // Create Marzipano scene when panorama URL changes
  useEffect(() => {
    if (!viewerRef.current || !activeScene?.panoramaObjectUrl) {
      sceneRef.current = null;
      viewRef.current = null;
      setViewInfo(null);
      return;
    }
    const { yaw, pitch, fov } = activeScene.initialView;
    const geometry = new Marzipano.EquirectGeometry([{ width: 4000 }]);
    const source = Marzipano.ImageUrlSource.fromString(activeScene.panoramaObjectUrl);
    const limiter = Marzipano.RectilinearView.limit.traditional(4096, 120 * Math.PI / 180);
    const view = new Marzipano.RectilinearView({ yaw, pitch, fov }, limiter);
    const scene = viewerRef.current.createScene({ source, geometry, view, pinFirstLevel: true });
    scene.switchTo();
    sceneRef.current = scene;
    viewRef.current = view;

    // Poll current view for display and capture
    let animId: number;
    function pollView() {
      const params = view.parameters();
      setViewInfo({ yaw: params.yaw, pitch: params.pitch, fov: params.fov });
      animId = requestAnimationFrame(pollView);
    }
    animId = requestAnimationFrame(pollView);
    return () => cancelAnimationFrame(animId);
  }, [activeScene?.panoramaObjectUrl]);

  // Sync hotspot markers to the Marzipano scene
  useEffect(() => {
    if (!sceneRef.current) return;
    const container = sceneRef.current.hotspotContainer();

    // Destroy previous markers
    hotspotHandlesRef.current.forEach((handle) => {
      try { container.destroyHotspot(handle); } catch { /* scene may already be gone */ }
    });
    hotspotHandlesRef.current = [];

    if (!activeScene) return;

    activeScene.hotspots.forEach((hotspot) => {
      const el = document.createElement('div');
      const isActive = hotspot.id === state.activeHotspotId;
      el.className = [
        'editor-hs',
        `editor-hs--${hotspot.type}`,
        isActive ? 'editor-hs--active' : '',
      ].filter(Boolean).join(' ');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        dispatch({ type: 'SET_ACTIVE_HOTSPOT', id: hotspot.id });
      });
      const handle = container.createHotspot(el, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      hotspotHandlesRef.current.push(handle);
    });
  }, [activeScene, state.activeHotspotId]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!state.placingHotspot || !viewRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const coords = viewRef.current.screenToCoordinates({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    if (!state.activeSceneId) return;
    const id = `hotspot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (state.placingHotspot === 'link') {
      dispatch({
        type: 'ADD_HOTSPOT',
        sceneId: state.activeSceneId,
        hotspot: {
          id,
          type: 'link',
          yaw: coords.yaw,
          pitch: coords.pitch,
          targetSceneId: '',
          targetYaw: 0,
          targetPitch: 0,
          targetFov: Math.PI / 2,
        },
      });
    } else {
      dispatch({
        type: 'ADD_HOTSPOT',
        sceneId: state.activeSceneId,
        hotspot: {
          id,
          type: 'info',
          yaw: coords.yaw,
          pitch: coords.pitch,
          content: { title: 'New info' },
        },
      });
    }
  }

  const hasScene = !!activeScene;
  const hasUrl = !!activeScene?.panoramaObjectUrl;

  function handleCapture() {
    if (!viewRef.current) return;
    const { yaw, pitch, fov } = viewRef.current.parameters();
    dispatch({ type: 'CAPTURE_VIEW', view: { yaw, pitch, fov } });
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={`${styles.canvas} ${state.placingHotspot ? styles.placing : ''}`}
        onClick={handleClick}
      />
      {!hasScene && (
        <div className={styles.placeholder}>Select a scene to preview it here</div>
      )}
      {hasScene && !hasUrl && (
        <div className={styles.placeholder}>No panorama image loaded</div>
      )}
      {state.placingHotspot && (
        <div className={styles.overlay}>
          Click to place &middot; Esc to cancel
        </div>
      )}
      {viewInfo && (
        <div className={styles.toolbar}>
          <button className={styles.captureBtn} onClick={handleCapture} title="Save current view for use as hotspot target arrival">
            Capture view
          </button>
          <div className={styles.viewInfo}>
            {(viewInfo.yaw / RAD).toFixed(1)}&deg; / {(viewInfo.pitch / RAD).toFixed(1)}&deg; / {(viewInfo.fov / RAD).toFixed(0)}&deg;
          </div>
        </div>
      )}
    </div>
  );
}
