export interface TileLevel {
  tileSize: number;
  size: number;
  fallbackOnly?: boolean;
}

export interface InitialView {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface InfoContent {
  title: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface NavHotspot {
  id: string;
  type: 'link';
  yaw: number;
  pitch: number;
  targetSceneId: string;
  targetYaw: number;
  targetPitch: number;
  targetFov: number;
}

export interface InfoHotspot {
  id: string;
  type: 'info';
  yaw: number;
  pitch: number;
  content: InfoContent;
}

export type Hotspot = NavHotspot | InfoHotspot;

export interface Scene {
  id: string;
  title: string;
  tilesPath: string;
  previewUrl: string;
  levels: TileLevel[];
  initialView: InitialView;
  hotspots: Hotspot[];
}

export interface TourData {
  version: string;
  defaultSceneId: string;
  scenes: Scene[];
}

export const DEFAULT_FOV = Math.PI / 2;
