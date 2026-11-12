import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Set VITE_BASE_PATH to your repository name when deploying to GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.svg'], manifest: { name: 'Workflow Organiser', short_name: 'Workflow', description: 'Your personal space for plans and priorities.', theme_color: '#f7f7f4', background_color: '#f7f7f4', display: 'standalone', start_url: '.', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] } })],
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
