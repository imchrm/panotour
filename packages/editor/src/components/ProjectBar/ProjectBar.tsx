import { useState } from 'react';
import { useTour } from '../../store/tourStore';
import {
  isElectron,
  createProjectFlow,
  openProjectFlow,
  saveProjectFlow,
  getProjectPath,
  projectToEditorScenes,
  readSceneObjectUrl,
  type ProjectData,
} from '../../lib/electronApi';
import styles from './ProjectBar.module.css';

export function ProjectBar() {
  const { state, dispatch } = useTour();
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isElectron()) return null;

  async function loadIntoStore(project: ProjectData) {
    const scenes = projectToEditorScenes(project);
    await Promise.all(
      scenes.map(async (scene) => {
        scene.panoramaObjectUrl = await readSceneObjectUrl(scene.id);
      }),
    );
    dispatch({
      type: 'LOAD_TOUR',
      defaultSceneId: project.defaultSceneId ?? '',
      scenes,
    });
    setProjectName(project.name);
  }

  async function run(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err: unknown) {
      setMessage({ ok: false, text: `${label}: ${(err as Error)?.message ?? 'failed'}` });
    } finally {
      setBusy(false);
    }
  }

  const handleCreate = () =>
    run('Create', async () => {
      const result = await createProjectFlow();
      if (result.canceled || !result.project) return;
      await loadIntoStore(result.project);
      setMessage({ ok: true, text: `Created: ${result.projectPath}` });
    });

  const handleOpen = () =>
    run('Open', async () => {
      const result = await openProjectFlow();
      if (result.canceled || !result.project) return;
      await loadIntoStore(result.project);
      setMessage({ ok: true, text: `Opened: ${result.projectPath}` });
    });

  const handleSave = () =>
    run('Save', async () => {
      await saveProjectFlow(state.tour);
      setMessage({ ok: true, text: 'Project saved' });
    });

  const hasProject = !!getProjectPath();

  return (
    <div className={styles.bar}>
      <button className={styles.btn} onClick={handleCreate} disabled={busy}>
        New project
      </button>
      <button className={styles.btn} onClick={handleOpen} disabled={busy}>
        Open
      </button>
      <button className={styles.btn} onClick={handleSave} disabled={busy || !hasProject}>
        Save
      </button>
      {projectName && <span className={styles.name}>{projectName}</span>}
      {message && (
        <span className={message.ok ? styles.ok : styles.error}>{message.text}</span>
      )}
    </div>
  );
}
