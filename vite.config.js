import { defineConfig } from 'vite';
export default defineConfig({
  base: '/homehome402/',
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
