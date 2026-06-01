import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readdirSync, statSync, readFileSync } from 'fs';

const VIEWER_DIR = resolve(__dirname, '../../packages/viewer');
const VIEWER_PREFIX = '/viewer/';

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.jpg':  'image/jpeg',
  '.png':  'image/png',
};

function mime(file: string): string {
  const ext = file.slice(file.lastIndexOf('.'));
  return MIME[ext] ?? 'application/octet-stream';
}

function collectFiles(dir: string, base = ''): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    const rel  = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full, rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

function viewerFilesPlugin() {
  return {
    name: 'viewer-files',

    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: () => void) => {
        if (!req.url?.startsWith(VIEWER_PREFIX)) return next();
        const rel  = req.url.slice(VIEWER_PREFIX.length).split('?')[0];
        if (rel.includes('..')) return next();
        const full = resolve(VIEWER_DIR, rel);
        try {
          const data = readFileSync(full);
          res.setHeader('Content-Type', mime(full));
          res.end(data);
        } catch {
          next();
        }
      });
    },

    generateBundle() {
      for (const rel of collectFiles(VIEWER_DIR)) {
        if (rel === 'tour.json') continue;
        (this as any).emitFile({
          type:     'asset',
          fileName: `viewer/${rel}`,
          source:   readFileSync(resolve(VIEWER_DIR, rel)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), viewerFilesPlugin()],
});
