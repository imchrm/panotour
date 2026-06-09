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
    el.innerHTML = '<div class="hotspot-scale"><div class="hotspot-inner"></div></div>';

    // Floor-perspective foreshortening on .hotspot-inner.
    // .hotspot-scale handles centering + FOV-based size scaling via CSS var.
    // sin(-pitch): 1 directly below viewer, 0 at horizon.
    // scaleX = sin(-p), scaleY = sin²(-p) — correct floor-circle aspect ratio.
    const sinP = Math.abs(Math.sin(hotspot.pitch));
    const sx = Math.max(0.25, sinP);
    const sy = Math.max(0.04, sinP * sinP);
    const inner = el.querySelector('.hotspot-inner');
    inner.style.transform = `scaleX(${sx.toFixed(3)}) scaleY(${sy.toFixed(3)})`;

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

