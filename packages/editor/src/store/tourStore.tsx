import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { type Scene, type Hotspot, DEFAULT_FOV } from './types';

export interface EditorScene extends Scene {
  panoramaObjectUrl?: string;
}

interface EditorState {
  tour: { version: string; defaultSceneId: string; scenes: EditorScene[] };
  activeSceneId: string | null;
  activeHotspotId: string | null;
  placingHotspot: false | 'link' | 'info';
}

type Action =
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
  | { type: 'CANCEL_PLACING_HOTSPOT' };

const initialState: EditorState = {
  tour: { version: '1.0', defaultSceneId: '', scenes: [] },
  activeSceneId: null,
  activeHotspotId: null,
  placingHotspot: false,
};

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'ADD_SCENE': {
      const scenes = [...state.tour.scenes, action.scene];
      const defaultSceneId = state.tour.defaultSceneId || action.scene.id;
      const activeSceneId = state.activeSceneId ?? action.scene.id;
      return {
        ...state,
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
      return {
        ...state,
        tour: { ...state.tour, scenes, defaultSceneId },
        activeSceneId,
        activeHotspotId: null,
      };
    }
    case 'SET_DEFAULT_SCENE':
      return { ...state, tour: { ...state.tour, defaultSceneId: action.id } };
    case 'SET_ACTIVE_SCENE':
      return { ...state, activeSceneId: action.id, activeHotspotId: null, placingHotspot: false };
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
      return { ...state, tour: { ...state.tour, scenes }, activeHotspotId };
    }
    case 'SET_ACTIVE_HOTSPOT':
      return { ...state, activeHotspotId: action.id };
    case 'START_PLACING_HOTSPOT':
      return { ...state, placingHotspot: action.hotspotType, activeHotspotId: null };
    case 'CANCEL_PLACING_HOTSPOT':
      return { ...state, placingHotspot: false };
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
