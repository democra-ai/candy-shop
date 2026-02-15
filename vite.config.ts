import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // On Vercel or Hugging Face Spaces, we want '/', on GitHub Pages we want '/candy-shop/'
  base: process.env.VERCEL || process.env.SPACE_ID ? '/' : '/candy-shop/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Vendor: UI libraries
          'vendor-ui': ['lucide-react', 'react-markdown', 'remark-gfm'],
          // Vendor: Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // Skills data (large static data)
          'skills-data': ['./src/data/skillsData.ts'],
        },
      },
    },
    // Increase chunk size warning limit slightly (still want to be aware)
    chunkSizeWarningLimit: 600,
  },
  server: {
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
});
