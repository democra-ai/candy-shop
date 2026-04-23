import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a fixed port and uses localhost
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
    // Disable HMR to prevent React Fast Refresh state corruption (black screens)
    // Forces clean full-page reload on every file change (~200ms)
    hmr: false,
    host: process.env.TAURI_DEV_HOST || 'localhost',
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  // Default base is '/' — Tauri, Vercel, HF Spaces, Cloudflare Pages all
  // serve assets at root. Only GitHub Pages (project page at
  // user.github.io/candy-shop) needs the /candy-shop/ prefix, opt in with
  // GITHUB_PAGES=1 pnpm build.
  base: process.env.GITHUB_PAGES ? '/candy-shop/' : '/',

  build: {
    // Tauri uses WebKit on macOS; Vercel/web uses modern targets
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105'
      : process.env.TAURI_ENV_PLATFORM ? 'safari13'
      : 'es2020',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-markdown', 'remark-gfm'],
          'skills-data': ['./src/data/skillsData.ts'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
