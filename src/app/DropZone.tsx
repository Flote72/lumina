import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { collectDroppedFiles } from '@/platform/fileAccess'
import { usePhotos } from '@/store/photos'

/** Window-wide drag-and-drop import with an overlay. */
export function DropZone() {
  const t = useT()
  const [active, setActive] = useState(false)

  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setActive(true)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setActive(false)
    }
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setActive(false)
      usePhotos.getState().importFiles(await collectDroppedFiles(e.dataTransfer!))
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-bg-0/80">
      <div className="rounded-lg border-2 border-dashed border-accent px-12 py-10 text-center">
        <div className="text-lg font-medium">{t('drop.title')}</div>
        <div className="mt-1 text-sm text-fg-2">{t('drop.body')}</div>
      </div>
    </div>
  )
}
