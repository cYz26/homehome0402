import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
export default defineConfig({
  base: '/homehome0402/',
  publicDir: '.asset-work/site-public',
  plugins: [{
    name: 'current-release-presentation',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const manifest = JSON.parse(readFileSync(new URL('./public/release.json', import.meta.url), 'utf8'));
        return html
          .replaceAll('__RELEASE_PREFIX__', `releases/${manifest.version}`)
          .replaceAll('__MODEL_VERSION__', manifest.version)
          .replaceAll('__MODEL_SHORT_VERSION__', manifest.version.replace(/^metric-/, ''));
      },
    },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if(id.includes('/three/build/three.core.js')) return 'three-core';
          if(id.includes('/three/build/')) return 'three-renderer';
          if(id.includes('/three/')) return 'three-addons';
        }
      }
    }
  }
});
