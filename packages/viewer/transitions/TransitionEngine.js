'use strict';

const T = {
  ZOOM_IN_FOV:   0.5236,  // ~30 degrees
  NORMAL_FOV:    1.5708,  // ~90 degrees
  ZOOM_DURATION: 600,
  FADE_DURATION: 400,
  LAND_DURATION: 500,
};

export class TransitionEngine {
  constructor(viewer, scenes) {
    // viewer: Marzipano.Viewer instance
    // scenes: Map<sceneId, { marzipanoScene, data }>
    this._viewer = viewer;
    this._scenes = scenes;
    this._busy = false;
  }

  navigate(fromSceneId, hotspot) {
    // fromSceneId: current scene id (tracked by app.js)
    // hotspot: NavHotspot data { yaw, pitch, targetSceneId, targetYaw, targetPitch, targetFov }
    if (this._busy) return;
    const from = this._scenes.get(fromSceneId);
    const to   = this._scenes.get(hotspot.targetSceneId);
    if (!from || !to) return;
    this._busy = true;

    const targetYaw   = hotspot.targetYaw   ?? 0;
    const targetPitch = hotspot.targetPitch ?? 0;
    const targetFov   = hotspot.targetFov   ?? T.NORMAL_FOV;

    // zoom in toward hotspot position
    from.marzipanoScene.lookTo(
      { yaw: hotspot.yaw, pitch: hotspot.pitch, fov: T.ZOOM_IN_FOV },
      { transitionDuration: T.ZOOM_DURATION }
    );

    setTimeout(() => {
      // position new scene before fade
      to.marzipanoScene.view().setParameters(
        { yaw: targetYaw, pitch: targetPitch, fov: T.ZOOM_IN_FOV }
      );
      to.marzipanoScene.switchTo({ transitionDuration: T.FADE_DURATION });

      setTimeout(() => {
        // zoom out in new scene
        to.marzipanoScene.lookTo(
          { yaw: targetYaw, pitch: targetPitch, fov: targetFov },
          { transitionDuration: T.LAND_DURATION }
        );
        setTimeout(() => { this._busy = false; }, T.LAND_DURATION);
      }, T.FADE_DURATION);

    }, Math.floor(T.ZOOM_DURATION / 2));
  }
}
