import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // GitHub Pages serves the app from /<repo-name>/. Local dev stays at /.
    // Set VITE_BASE_PATH in CI (see .github/workflows/deploy-pages.yml).
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react_vendor';
            }
            if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
              return 'firebase_vendor';
            }
            if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/canvas-confetti/')) {
              return 'ui_vendor';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // Allow the Arena live-preview proxy host to reach the dev server.
      allowedHosts: ['.e2b.app'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
