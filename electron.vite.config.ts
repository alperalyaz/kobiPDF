import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

/** Injects the Content-Security-Policy; dev additionally allows Vite's HMR client. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'kobipdf-csp',
    transformIndexHtml(_html, ctx) {
      const dev = Boolean(ctx.server)
      const policy = [
        "default-src 'self'",
        `script-src 'self' 'wasm-unsafe-eval'${dev ? " 'unsafe-inline'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        `connect-src 'self'${dev ? ' ws: http://localhost:*' : ''}`,
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ].join('; ')
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

// `--mode android` builds the renderer for the Capacitor app (see capacitor.config.json):
// window.api then comes from platform/androidApi.ts instead of the Electron preload,
// so no Capacitor code ends up in the desktop bundle.
export default defineConfig(({ mode }) => {
  const android = mode === 'android'
  return {
    main: {},
    preload: {},
    renderer: {
      define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __ANDROID__: JSON.stringify(android)
      },
      resolve: {
        alias: {
          '@renderer': resolve(__dirname, 'src/renderer/src'),
          '@platform-api': resolve(
            __dirname,
            android ? 'src/renderer/src/platform/androidApi.ts' : 'src/renderer/src/platform/desktopApi.ts'
          )
        }
      },
      plugins: [contentSecurityPolicy(), react(), tailwindcss()]
    }
  }
})
