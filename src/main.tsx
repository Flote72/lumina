import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import './index.css'

// Dev-only handle for manual/automated testing from the console.
if (import.meta.env.DEV) Object.assign(window, { __lumina: { usePhotos, useDevelop } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
