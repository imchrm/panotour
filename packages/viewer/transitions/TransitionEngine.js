'use strict';

import { easeOutCubic } from './easing.js';

const T = {
  WIDE_FOV:      1.7453,  // ~100° — brief inhale before rush
  NORMAL_FOV:    1.5708,  // ~90°
  ZOOM_IN_FOV:   0.3491,  // ~20° — aggressive zoom for movement feel
  INHALE_MS:     80,      // wind-up sub-phase
  RUSH_MS:       520,     // main zoom-in sub-phase
  get ZOOM_DURATION() { return this.INHALE_MS + this.RUSH_MS; }, // 600ms total
  FADE_DURATION: 280,
  LAND_DURATION: 650,
};

// Animate FOV with a custom easing curve using rAF.
// Safe to use when no concurrent lookTo is animating the same view.
function animateFov(view, fromFov, toFov, duration, easingFn, onDone) {
  const t0 = performance.now();
  const { yaw, pitch } = view.parameters();
  function tick(now) {
    const p = Math.min((now - t0) / duration, 1);
    view.setParameters({ yaw, pitch, fov: fromFov + (toFov - fromFov) * easingFn(p) });
    if (p < 1) requestAnimationFrame(tick);
    else onDone?.();
  }
  requestAnimationFrame(tick);
}

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
      // Position new scene at arrival view with tight FOV before fade-in
      to.marzipanoScene.view().setParameters(
        { yaw: targetYaw, pitch: targetPitch, fov: T.ZOOM_IN_FOV }
      );
      to.marzipanoScene.switchTo({ transitionDuration: T.FADE_DURATION });

      setTimeout(() => {
        // Phase 3 — land: expand FOV with easeOut for smooth arrival feel.
        // No concurrent lookTo here, so rAF animation is conflict-free.
        animateFov(
          to.marzipanoScene.view(),
          T.ZOOM_IN_FOV,
          targetFov,
          T.LAND_DURATION,
          easeOutCubic,
          () => { this._busy = false; }
        );
      }, T.FADE_DURATION);

    }, FADE_START);
  }
}
