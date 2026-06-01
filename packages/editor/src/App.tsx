import { useEffect } from 'react';
import { TourProvider, useTour } from './store/tourStore';
import { PanoramaList } from './components/PanoramaList/PanoramaList';
import { PanoramaCanvas } from './components/PanoramaCanvas/PanoramaCanvas';
import { SceneSettings } from './components/SceneSettings/SceneSettings';
import { HotspotPanel } from './components/HotspotPanel/HotspotPanel';
import './App.css';

function EditorApp() {
  const { dispatch } = useTour();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dispatch({ type: 'CANCEL_PLACING_HOTSPOT' });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return (
    <div className="app">
      <div className="left-panel">
        <PanoramaList />
      </div>
      <div className="canvas-area">
        <PanoramaCanvas />
      </div>
      <div className="right-panel">
        <SceneSettings />
        <HotspotPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TourProvider>
      <EditorApp />
    </TourProvider>
  );
}
