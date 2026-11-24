/// <reference types="vite/client" />
/// <reference path="../../preload/index.d.ts" />

/** package.json version, injected by Vite at build time. */
declare const __APP_VERSION__: string

/** True in the Android (Capacitor) build, `electron-vite build --mode android`. */
declare const __ANDROID__: boolean

/** Installs window.api where no Electron preload provides it; resolved per build mode in electron.vite.config.ts. */
declare module '@platform-api' {}
