import type { Hotspot, InitialView, TileLevel, TourData } from '../store/types';
import type { EditorScene } from '../store/tourStore';
import { DEFAULT_FOV } from '../store/types';
import { panoramaPreviewUrl } from './panoramaPreview';

export interface ProjectScene {
  id: string;
  title?: string;
  sourceFile?: string;
  originalPath?: string;
  sourceHash?: string;
  tiledAt?: string;
  tilesPath?: string;
  previewUrl?: string;
  levels?: TileLevel[];
  mobileLevels?: TileLevel[];
  initialView?: InitialView;
  hotspots?: Hotspot[];
}

export interface ProjectData {
  schemaVersion: string;
  name: string;
  createdAt: string;
  defaultLang: string;
  defaultSceneId: string | null;
  autorotate: { enabled: boolean; speed: number };
  scenes: ProjectScene[];
}

export interface ProjectResult {
  canceled: boolean;
  projectPath?: string;
  project?: ProjectData;
}

export interface TileResult {
  sceneId: string;
  tilesPath: string;
  previewUrl: string;
  levels: TileLevel[];
  mobileLevels?: TileLevel[];
  sourceHash: string;
  tiledAt: string;
}

export interface ElectronApi {
  ping(): string;
  createProject(opts?: { name?: string; dirPath?: string }): Promise<ProjectResult>;
  openProject(opts?: { dirPath?: string }): Promise<ProjectResult>;
  saveProject(data: ProjectData): Promise<{ projectPath: string }>;
  currentProject(): Promise<{ projectPath: string; project: ProjectData } | null>;
  addScene(sceneId: string, srcPath?: string): Promise<{ canceled: boolean; sceneId?: string; sourceFile?: string; originalPath?: string }>;
  deleteScene(sceneId: string): Promise<{ scenes: string[] }>;
  readScene(sceneId: string): Promise<Uint8Array>;
  tileScene(sceneId: string, onProgress?: (progress: string) => void): Promise<TileResult>;
  tileAll(sceneIds: string[]): Promise<Array<{ ok: boolean; sceneId: string; error?: string }>>;
  openPreview(tourJson: TourData, opts?: { sceneId?: string }): Promise<{ previewDir: string }>;
  exportFolder(tourJson: TourData, opts?: { dirPath?: string }): Promise<{ canceled: boolean; exportPath?: string }>;
  exportZip(tourJson: TourData, opts?: { filePath?: string }): Promise<{ canceled: boolean; exportPath?: string }>;
  setDirty(dirty: boolean): void;
}

declare global {
  interface Window {
    electronApi?: ElectronApi;
  }
}

export function getElectronApi(): ElectronApi | null {
  return window.electronApi ?? null;
}

export function isElectron(): boolean {
  return !!window.electronApi;
}

export async function readSceneObjectUrl(sceneId: string): Promise<string | undefined> {
  const api = getElectronApi();
  if (!api) return undefined;
  try {
    const data = await api.readScene(sceneId);
    const blob = new Blob([new Uint8Array(data)], { type: 'image/jpeg' });
    return await panoramaPreviewUrl(blob);
  } catch {
    return undefined;
  }
}

let currentProjectPath: string | null = null;

export function getProjectPath(): string | null {
  return currentProjectPath;
}

export async function createProjectFlow(name?: string): Promise<ProjectResult> {
  const api = getElectronApi();
  if (!api) throw new Error('Not running in Electron');
  const result = await api.createProject({ name });
  if (!result.canceled && result.projectPath) currentProjectPath = result.projectPath;
  return result;
}

export async function restoreProjectFlow(): Promise<ProjectResult | null> {
  const api = getElectronApi();
  if (!api) return null;
  const current = await api.currentProject();
  if (!current) return null;
  currentProjectPath = current.projectPath;
  return { canceled: false, projectPath: current.projectPath, project: current.project };
}

export async function openProjectFlow(): Promise<ProjectResult> {
  const api = getElectronApi();
  if (!api) throw new Error('Not running in Electron');
  const result = await api.openProject();
  if (!result.canceled && result.projectPath) currentProjectPath = result.projectPath;
  return result;
}

export async function saveProjectFlow(tour: {
  defaultSceneId: string;
  scenes: EditorScene[];
}): Promise<void> {
  const api = getElectronApi();
  if (!api) throw new Error('Not running in Electron');
  if (!currentProjectPath) throw new Error('No project is open');
  const fresh = await api.openProject({ dirPath: currentProjectPath });
  if (fresh.canceled || !fresh.project) throw new Error('Failed to reload project');
  await api.saveProject(mergeEditorStateIntoProject(fresh.project, tour));
}

export function projectToEditorScenes(project: ProjectData): EditorScene[] {
  return project.scenes.map((s) => ({
    id: s.id,
    title: s.title ?? s.id,
    originalPath: s.originalPath,
    tilesPath: s.tilesPath ?? `tiles/${s.id}`,
    previewUrl: s.previewUrl ?? `tiles/${s.id}/preview.jpg`,
    levels: s.levels ?? [],
    initialView: s.initialView ?? { yaw: 0, pitch: 0, fov: DEFAULT_FOV },
    hotspots: s.hotspots ?? [],
  }));
}

export function mergeEditorStateIntoProject(
  project: ProjectData,
  tour: { defaultSceneId: string; scenes: EditorScene[] },
): ProjectData {
  const scenes: ProjectScene[] = tour.scenes.map((s) => {
    const persisted = project.scenes.find((p) => p.id === s.id) ?? {
      id: s.id,
      sourceFile: `scenes/${s.id}.jpg`,
    };
    return {
      ...persisted,
      title: s.title,
      originalPath: s.originalPath ?? persisted.originalPath,
      tilesPath: s.tilesPath,
      previewUrl: s.previewUrl,
      levels: s.levels,
      initialView: s.initialView,
      hotspots: s.hotspots,
    };
  });
  return { ...project, defaultSceneId: tour.defaultSceneId || null, scenes };
}
