import { InfoPanel } from './InfoPanel.js';

export class InfoHotspot {
  /**
   * @param {object} marzipanoScene
   * @param {object} hotspot  - InfoHotspot data from tour.json
   */
  static create(marzipanoScene, hotspot) {
    const el = document.createElement('div');
    el.className = 'hotspot hotspot-info';
    el.setAttribute('data-id', hotspot.id);
    el.innerHTML = '<div class="hotspot-inner"><span class="hotspot-info-icon">i</span></div>';

    let panelEl = null;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panelEl) return;
      panelEl = InfoPanel.show(hotspot.content, () => { panelEl = null; });
    });

    marzipanoScene.hotspotContainer().createHotspot(el, {
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
    });

    return el;
  }
}
