import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Set VITE_BASE_PATH to your repository name when deploying to GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.svg'], manifest: { name: 'Workflow Organiser', short_name: 'Workflow', description: 'Your personal space for plans and priorities.', theme_color: '#f7f7f4', background_color: '#f7f7f4', display: 'standalone', start_url: '.', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] } })]
});
