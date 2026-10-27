import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Mi Armario',
        short_name: 'Armario',
        description: 'Tu ropa catalogada y combinada, todo en tu celular.',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f2ee',
        theme_color: '#f4f2ee',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest}'],
        // El worker de recorte y onnxruntime no van al precache: se bajan y cachean la primera vez que se usan.
        globIgnores: ['**/ort*', '**/bg.worker*'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/(ort|bg\.worker)/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'bg-removal-runtime', expiration: { maxEntries: 20 } },
          },
          {
            // Modelo ONNX + WASM del recorte: se baja la primera vez que se usa y queda cacheado.
            urlPattern: ({ url }) => url.hostname === 'staticimgly.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'bg-removal-model',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as any);
