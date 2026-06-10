'use strict';

const T = {
  WIDE_FOV:      1.7453,  // ~100° — brief inhale before rush
  NORMAL_FOV:    1.5708,  // ~90°
  ZOOM_IN_FOV:   0.3491,  // ~20° — aggressive zoom for movement feel
  INHALE_MS:     80,      // wind-up sub-phase
  RUSH_MS:       520,     // main zoom-in sub-phase
  FADE_DURATION: 280,
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

    // Phase 1a — inhale: rotate to hotspot + subtly widen FOV (80ms)
    from.marzipanoScene.lookTo(
      { yaw: hotspot.yaw, pitch: hotspot.pitch, fov: T.WIDE_FOV },
      { transitionDuration: T.INHALE_MS }
    );

    // Phase 1b — rush: continue rotation lock + aggressive zoom-in (520ms)
    setTimeout(() => {
      from.marzipanoScene.lookTo(
        { yaw: hotspot.yaw, pitch: hotspot.pitch, fov: T.ZOOM_IN_FOV },
        { transitionDuration: T.RUSH_MS }
      );
    }, T.INHALE_MS);

    // Start crossfade at 70% through Phase 1b so most of the zoom is done
    const FADE_START = T.INHALE_MS + Math.floor(T.RUSH_MS * 0.7);  // ~444ms

    setTimeout(() => {
      // Position new scene at arrival view before fade-in.
      // Set targetFov directly — no post-arrival expansion needed.
      to.marzipanoScene.view().setParameters(
        { yaw: targetYaw, pitch: targetPitch, fov: targetFov }
      );
      to.marzipanoScene.switchTo({ transitionDuration: T.FADE_DURATION });

      setTimeout(() => {
        this._busy = false;
      }, T.FADE_DURATION);

    }, FADE_START);
  }
}
