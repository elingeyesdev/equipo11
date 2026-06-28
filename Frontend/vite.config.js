/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: process.env.NODE_ENV !== 'production',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'EnviroSense - Monitoreo Ambiental',
        short_name: 'EnviroSense',
        description: 'Plataforma PWA de monitoreo ambiental y alertas en tiempo real para Sudamérica.',
        theme_color: '#2a5a35',
        background_color: '#f4f2ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['weather', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('mapbox-gl') || id.includes('react-map-gl/mapbox')) return 'vendor-mapbox';
          if (id.includes('echarts') || id.includes('echarts-for-react')) return 'vendor-echarts';
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'vendor-pdf';
          if (id.includes('firebase/app') || id.includes('firebase/messaging')) return 'vendor-firebase';
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    hmr: {
      clientPort: 5173,
      overlay: false,
    },
    watch: {
      usePolling: process.env.WATCH_POLLING === '1',
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    }
  }
})
