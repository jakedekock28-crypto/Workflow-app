import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Set VITE_BASE_PATH to your repository name when deploying to GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['logo.svg', 'favicon-32.png', 'apple-touch-icon.png'],
    manifest: {
      name: 'Workflow Organiser',
      short_name: 'Workflow',
      description: 'Your personal space for plans and priorities.',
      theme_color: '#12392F',
      background_color: '#f7f7f4',
      display: 'standalone',
      start_url: '.',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
  })],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/framer-motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) return 'vendor-motion';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/date-fns/')) return 'vendor-dates';
          if (id.includes('/zustand/')) return 'vendor-state';
          return 'vendor-other';
        }
      }
    }
  }
});
