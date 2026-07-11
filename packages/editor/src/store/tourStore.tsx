import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { type Scene, type Hotspot, DEFAULT_FOV } from './types';

export interface EditorScene extends Scene {
  panoramaObjectUrl?: string;
  originalPath?: string;
}

interface CapturedView {
  yaw: number;
  pitch: number;
  fov: number;
}

interface EditorState {
  tour: { version: string; defaultSceneId: string; scenes: EditorScene[] };
  activeSceneId: string | null;
  activeHotspotId: string | null;
  placingHotspot: false | 'link' | 'info';
  capturedView: CapturedView | null;
  flipArrivalYaw: boolean;
  sceneHistory: string[];
  historyIndex: number;
  pendingDeleteHotspot: { sceneId: string; id: string } | null;
}

type Action =
  | { type: 'LOAD_TOUR'; defaultSceneId: string; scenes: EditorScene[] }
  | { type: 'ADD_SCENE'; scene: EditorScene }
  | { type: 'UPDATE_SCENE'; id: string; patch: Partial<EditorScene> }
  | { type: 'DELETE_SCENE'; id: string }
  | { type: 'SET_DEFAULT_SCENE'; id: string }
  | { type: 'SET_ACTIVE_SCENE'; id: string | null }
  | { type: 'ADD_HOTSPOT'; sceneId: string; hotspot: Hotspot }
  | { type: 'UPDATE_HOTSPOT'; sceneId: string; id: string; patch: Partial<Hotspot> }
  | { type: 'DELETE_HOTSPOT'; sceneId: string; id: string }
  | { type: 'SET_ACTIVE_HOTSPOT'; id: string | null }
  | { type: 'START_PLACING_HOTSPOT'; hotspotType: 'link' | 'info' }
  | { type: 'CANCEL_PLACING_HOTSPOT' }
  | { type: 'CAPTURE_VIEW'; view: CapturedView }
  | { type: 'TOGGLE_FLIP_ARRIVAL_YAW' }
  | { type: 'HISTORY_BACK' }
  | { type: 'HISTORY_FORWARD' }
  | { type: 'MOVE_SCENE'; id: string; toIndex: number }
  | { type: 'REQUEST_DELETE_HOTSPOT'; sceneId: string; id: string }
  | { type: 'CANCEL_DELETE_HOTSPOT' };

const initialState: EditorState = {
  tour: { version: '1.0', defaultSceneId: '', scenes: [] },
  activeSceneId: null,
  activeHotspotId: null,
  placingHotspot: false,
  capturedView: null,
  flipArrivalYaw: true,
  sceneHistory: [],
  historyIndex: -1,
  pendingDeleteHotspot: null,
};

function pushHistory(
  state: Pick<EditorState, 'sceneHistory' | 'historyIndex'>,
  id: string,
): Pick<EditorState, 'sceneHistory' | 'historyIndex'> {
  if (state.sceneHistory[state.historyIndex] === id) return state;
  const sceneHistory = [...state.sceneHistory.slice(0, state.historyIndex + 1), id];
  return { sceneHistory, historyIndex: sceneHistory.length - 1 };
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'LOAD_TOUR': {
      const defaultSceneId = action.defaultSceneId || action.scenes[0]?.id || '';
      const first = action.scenes[0]?.id ?? null;
      return {
        ...initialState,
        tour: { version: state.tour.version, defaultSceneId, scenes: action.scenes },
        activeSceneId: first,
        sceneHistory: first ? [first] : [],
        historyIndex: first ? 0 : -1,
      };
    }
    case 'ADD_SCENE': {
      const scenes = [...state.tour.scenes, action.scene];
      const defaultSceneId = state.tour.defaultSceneId || action.scene.id;
      const activeSceneId = state.activeSceneId ?? action.scene.id;
      return {
        ...state,
        ...pushHistory(state, activeSceneId),
        tour: { ...state.tour, scenes, defaultSceneId },
        activeSceneId,
      };
    }
    case 'UPDATE_SCENE': {
      const scenes = state.tour.scenes.map((s) =>
        s.id === action.id ? { ...s, ...action.patch } : s
      );
      return { ...state, tour: { ...state.tour, scenes } };
    }
    case 'DELETE_SCENE': {
      const scenes = state.tour.scenes.filter((s) => s.id !== action.id);
      let { defaultSceneId } = state.tour;
      if (defaultSceneId === action.id) {
        defaultSceneId = scenes[0]?.id ?? '';
      }
      let activeSceneId = state.activeSceneId;
      if (activeSceneId === action.id) {
        activeSceneId = scenes[0]?.id ?? null;
      }
      const sceneHistory: string[] = [];
      let historyIndex = -1;
      state.sceneHistory.forEach((id, i) => {
        if (id === action.id || sceneHistory[sceneHistory.length - 1] === id) return;
        sceneHistory.push(id);
        if (i <= state.historyIndex) historyIndex = sceneHistory.length - 1;
      });
      let history = { sceneHistory, historyIndex };
      if (activeSceneId && sceneHistory[historyIndex] !== activeSceneId) {
        history = pushHistory(history, activeSceneId);
      }
      return {
        ...state,
        ...history,
        tour: { ...state.tour, scenes, defaultSceneId },
        activeSceneId,
        activeHotspotId: null,
      };
    }
    case 'MOVE_SCENE': {
      const from = state.tour.scenes.findIndex((s) => s.id === action.id);
      if (from < 0) return state;
      const scenes = [...state.tour.scenes];
      const [moved] = scenes.splice(from, 1);
      const to = Math.max(0, Math.min(action.toIndex, scenes.length));
      scenes.splice(to, 0, moved);
      return { ...state, tour: { ...state.tour, scenes } };
    }
    case 'SET_DEFAULT_SCENE':
      return { ...state, tour: { ...state.tour, defaultSceneId: action.id } };
    case 'SET_ACTIVE_SCENE': {
      const base: EditorState = { ...state, activeSceneId: action.id, activeHotspotId: null, placingHotspot: false };
      if (action.id === null) return base;
      return { ...base, ...pushHistory(state, action.id) };
    }
    case 'HISTORY_BACK': {
      if (state.historyIndex <= 0) return state;
      const historyIndex = state.historyIndex - 1;
      return {
        ...state,
        historyIndex,
        activeSceneId: state.sceneHistory[historyIndex],
        activeHotspotId: null,
        placingHotspot: false,
      };
    }
    case 'HISTORY_FORWARD': {
      if (state.historyIndex >= state.sceneHistory.length - 1) return state;
      const historyIndex = state.historyIndex + 1;
      return {
        ...state,
        historyIndex,
        activeSceneId: state.sceneHistory[historyIndex],
        activeHotspotId: null,
        placingHotspot: false,
      };
    }
    case 'ADD_HOTSPOT': {
      const scenes = state.tour.scenes.map((s) =>
        s.id === action.sceneId
          ? { ...s, hotspots: [...s.hotspots, action.hotspot] }
          : s
      );
      return {
        ...state,
        tour: { ...state.tour, scenes },
        activeHotspotId: action.hotspot.id,
        placingHotspot: false,
      };
    }
    case 'UPDATE_HOTSPOT': {
      const scenes = state.tour.scenes.map((s) => {
        if (s.id !== action.sceneId) return s;
        const hotspots = s.hotspots.map((h) =>
          h.id === action.id ? ({ ...h, ...action.patch } as Hotspot) : h
        );
        return { ...s, hotspots };
      });
      return { ...state, tour: { ...state.tour, scenes } };
    }
    case 'DELETE_HOTSPOT': {
      const scenes = state.tour.scenes.map((s) => {
        if (s.id !== action.sceneId) return s;
        return { ...s, hotspots: s.hotspots.filter((h) => h.id !== action.id) };
      });
      const activeHotspotId =
        state.activeHotspotId === action.id ? null : state.activeHotspotId;
      return {
        ...state,
        tour: { ...state.tour, scenes },
        activeHotspotId,
        pendingDeleteHotspot: null,
      };
    }
    case 'REQUEST_DELETE_HOTSPOT':
      return { ...state, pendingDeleteHotspot: { sceneId: action.sceneId, id: action.id } };
    case 'CANCEL_DELETE_HOTSPOT':
      return { ...state, pendingDeleteHotspot: null };
    case 'SET_ACTIVE_HOTSPOT':
      return { ...state, activeHotspotId: action.id };
    case 'START_PLACING_HOTSPOT':
      return { ...state, placingHotspot: action.hotspotType, activeHotspotId: null };
    case 'CANCEL_PLACING_HOTSPOT':
      return { ...state, placingHotspot: false };
    case 'CAPTURE_VIEW':
      return { ...state, capturedView: action.view };
    case 'TOGGLE_FLIP_ARRIVAL_YAW':
      return { ...state, flipArrivalYaw: !state.flipArrivalYaw };
    default:
      return state;
  }
}

interface TourContextValue {
  state: EditorState;
  dispatch: React.Dispatch<Action>;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <TourContext.Provider value={{ state, dispatch }}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

export { DEFAULT_FOV };
