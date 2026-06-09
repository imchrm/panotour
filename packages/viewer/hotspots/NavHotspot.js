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

    // Floor-perspective transform applied to the *inner* element.
    // Marzipano calls positionAbsolutely() on the outer el every frame,
    // overwriting its inline transform with translate(Xpx, Ypx).
    // The inner element is untouched, so we apply the foreshortening there.
    // sin(-pitch): 1 directly below the viewer, 0 at the horizon.
    // scaleX = sin(-p)  — horizontal shrinks with distance
    // scaleY = sin²(-p) — vertical shrinks twice as fast (foreshortening)
    const sinP = Math.abs(Math.sin(hotspot.pitch));
    const sx = Math.max(0.25, sinP);
    const sy = Math.max(0.04, sinP * sinP);
    const inner = el.querySelector('.hotspot-inner');
    inner.style.transform = `translate(-50%, -50%) scaleX(${sx.toFixed(3)}) scaleY(${sy.toFixed(3)})`;

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

