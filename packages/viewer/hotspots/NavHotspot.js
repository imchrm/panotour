export class NavHotspot {
  /**
   * @param {object} marzipanoScene  - Marzipano scene object
   * @param {object} hotspot         - NavHotspot data from tour.json
   * @param {function} onNavigate    - callback(hotspot) called on click
   */
  static create(marzipanoScene, hotspot, onNavigate) {
    const el = document.createElement('div');
    el.className = 'hotspot hotspot-nav';
    el.setAttribute('data-id', hotspot.id);
    el.innerHTML = '<div class="hotspot-inner"></div>';

    // Floor-perspective transform: a circle lying flat on the ground.
    // sin(-pitch): 1 directly below the viewer, 0 at the horizon.
    // scaleX = sin(-p)       — horizontal shrinks with distance
    // scaleY = sin²(-p)      — vertical shrinks twice as fast (foreshortening)
    // This produces the correct aspect ratio for a floor circle seen at angle p.
    const sinP = Math.abs(Math.sin(hotspot.pitch));
    const sx = Math.max(0.25, sinP);
    const sy = Math.max(0.04, sinP * sinP);
    el.style.transform =
      `translate(-50%, -50%) scaleX(${sx.toFixed(3)}) scaleY(${sy.toFixed(3)})`;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onNavigate(hotspot);
    });

    marzipanoScene.hotspotContainer().createHotspot(el, {
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
    });

    return el;
  }
}

