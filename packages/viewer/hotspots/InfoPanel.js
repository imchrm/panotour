export class InfoPanel {
  /**
   * @param {object} content  - InfoContent: { title, text?, imageUrl?, videoUrl? }
   * @param {function} onClose
   * @returns {HTMLElement} overlay element
   */
  static show(content, onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'info-panel-overlay';

    const panel = document.createElement('div');
    panel.className = 'info-panel';
    panel.setAttribute('role', 'dialog');

    // Title
    if (content.title) {
      const h2 = document.createElement('h2');
      h2.className = 'info-panel-title';
      h2.textContent = content.title;
      panel.appendChild(h2);
    }

    // Text
    if (content.text) {
      const p = document.createElement('div');
      p.className = 'info-panel-text';
      p.innerHTML = content.text; // allows basic HTML
      panel.appendChild(p);
    }

    // Image
    if (content.imageUrl) {
      const img = document.createElement('img');
      img.className = 'info-panel-image';
      img.src = content.imageUrl;
      img.alt = content.title ?? '';
      panel.appendChild(img);
    }

    // Video -- YouTube iframe or <video>
    if (content.videoUrl) {
      const mediaEl = InfoPanel._buildMedia(content.videoUrl);
      panel.appendChild(mediaEl);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'info-panel-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const close = () => {
      InfoPanel._stopMedia(panel);
      overlay.remove();
      onClose();
    };

    closeBtn.addEventListener('click', close);

    // Click outside panel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Escape key
    const handleKey = (e) => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handleKey); }
    };
    document.addEventListener('keydown', handleKey);

    return overlay;
  }

  static _buildMedia(url) {
    const wrap = document.createElement('div');
    wrap.className = 'info-panel-media';

    const isYouTube = /youtube\.com\/embed\/|youtu\.be\//.test(url);
    if (isYouTube) {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      wrap.appendChild(iframe);
    } else {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.className = 'info-panel-video';
      wrap.appendChild(video);
    }

    return wrap;
  }

  static _stopMedia(panel) {
    // Stop <video>
    panel.querySelectorAll('video').forEach(v => { v.pause(); v.src = ''; });
    // Stop YouTube iframe by clearing src
    panel.querySelectorAll('iframe').forEach(f => { f.src = ''; });
  }
}
