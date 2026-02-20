import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a fixed port and uses localhost
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
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

  // Tauri builds use '/', Vercel/HF Spaces use '/', GitHub Pages uses '/candy-shop/'
  base: process.env.TAURI_ENV_PLATFORM || process.env.VERCEL || process.env.SPACE_ID ? '/' : '/candy-shop/',

  build: {
    // Tauri uses WebKit on macOS
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-markdown', 'remark-gfm'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'skills-data': ['./src/data/skillsData.ts'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
