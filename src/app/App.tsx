import { useEffect, useState } from 'react'
import { Shell } from '@/layout/Shell'
import { useUiStore } from '@/store/ui'
import { DesignGallery } from './DesignGallery'
import { DropZone } from './DropZone'
import { Toasts } from './Toasts'
import { ErrorBoundary } from './ErrorBoundary'
import { UnsupportedBanner } from './UnsupportedBanner'
import { useShortcuts } from './useShortcuts'

export default function App() {
  useShortcuts()
  const lang = useUiStore((s) => s.lang)
  const [hash, setHash] = useState(location.hash)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col">
        <UnsupportedBanner />
        <DropZone />
        <Toasts />
        <div className="min-h-0 flex-1">{hash === '#/design' ? <DesignGallery /> : <Shell />}</div>
      </div>
    </ErrorBoundary>
  )
}
