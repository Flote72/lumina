import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import { exportPhoto } from '@/export/exportClient'
import { developRaw } from '@/raw/developRaw'
import { useDevelop } from '@/store/develop'
import { useExportSettings } from '@/store/exportSettings'
import { usePhotos } from '@/store/photos'
import './index.css'

// Dev-only handle for manual/automated testing from the console.
if (import.meta.env.DEV) Object.assign(window, { __lumina: { usePhotos, useDevelop, useExportSettings, exportPhoto, developRaw } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline / install support (production builds only, so dev hot reload is never served from a stale cache).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
