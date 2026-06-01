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
