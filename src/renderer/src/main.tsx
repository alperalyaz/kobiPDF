// Must stay the first import: some modules read window.api while they load.
import '@platform-api'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './locales/i18n'
import './index.css'
import App from './App'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
