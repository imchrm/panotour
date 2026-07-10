import { useEffect, useRef, useState } from 'react';
import { TourProvider, useTour } from './store/tourStore';
import { PanoramaList } from './components/PanoramaList/PanoramaList';
import { PanoramaCanvas } from './components/PanoramaCanvas/PanoramaCanvas';
import { CanvasErrorBoundary } from './components/PanoramaCanvas/CanvasErrorBoundary';
import { SceneSettings } from './components/SceneSettings/SceneSettings';
import { HotspotPanel } from './components/HotspotPanel/HotspotPanel';
import { ExportButton } from './components/ExportButton/ExportButton';
import { ProjectBar } from './components/ProjectBar/ProjectBar';
import './App.css';

const LEFT_PANEL_MIN = 160;
const LEFT_PANEL_MAX = 480;
const LEFT_PANEL_DEFAULT = 220;
const LEFT_PANEL_KEY = 'panotour.leftPanelWidth';

function initialLeftPanelWidth(): number {
  const stored = parseInt(localStorage.getItem(LEFT_PANEL_KEY) ?? '', 10);
  if (isNaN(stored)) return LEFT_PANEL_DEFAULT;
  return Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, stored));
}

function EditorApp() {
  const { dispatch } = useTour();
  const [leftWidth, setLeftWidth] = useState(initialLeftPanelWidth);
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    localStorage.setItem(LEFT_PANEL_KEY, String(leftWidth));
  }, [leftWidth]);

  function handleResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: leftWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const width = drag.startWidth + (e.clientX - drag.startX);
    setLeftWidth(Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, width)));
  }

  function handleResizeEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      setResizing(false);
    }
  }

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
      <header className="app-header">
        <span className="app-title">panotour editor</span>
        <ProjectBar />
        <ExportButton />
      </header>
      <div
        className="app-body"
        style={{ ['--panel-width-left' as string]: `${leftWidth}px` }}
      >
        <div className="left-panel">
          <PanoramaList />
        </div>
        <div
          className={`panel-resizer ${resizing ? 'panel-resizer--active' : ''}`}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          onDoubleClick={() => setLeftWidth(LEFT_PANEL_DEFAULT)}
          title="Drag to resize, double-click to reset"
        />
        <div className="canvas-area">
          <CanvasErrorBoundary>
            <PanoramaCanvas />
          </CanvasErrorBoundary>
        </div>
        <div className="right-panel">
          <SceneSettings />
          <HotspotPanel />
        </div>
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
