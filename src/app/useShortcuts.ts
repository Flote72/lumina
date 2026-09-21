import { useEffect } from 'react'
import { cancelCrop, applyCrop, toggleCrop } from '@/develop/cropActions'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import { useUiStore } from '@/store/ui'

const isEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
}
const isSliderLike = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('[role="slider"],[role="separator"]')

/** Global shortcuts (Lightroom-like). Rating/flag/copy-paste keys arrive with the Library phase. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      const ui = useUiStore.getState()
      const dev = useDevelop.getState()
      const key = e.key.toLowerCase()
      const mod = e.metaKey || e.ctrlKey

      // Undo / redo
      if (mod && !e.altKey && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) usePhotos.getState().redo()
        else usePhotos.getState().undo()
        return
      }
      if (mod && !e.altKey && key === 'y') {
        e.preventDefault()
        usePhotos.getState().redo()
        return
      }
      if (mod || e.altKey) return

      const develop = ui.module === 'develop'
      switch (key) {
        case 'g':
        case 'e':
          if (dev.cropEdit) cancelCrop()
          ui.setModule('library')
          break
        case 'd':
          ui.setModule('develop')
          break
        case 'r':
          if (develop) toggleCrop()
          break
        case '\\':
          if (develop) dev.cycleCompare()
          break
        case 'j':
          if (develop) dev.toggleClipping()
          break
        case 'o':
          if (develop && dev.cropEdit) dev.cycleGuide()
          break
        case 'enter':
          if (dev.cropEdit && !(e.target as HTMLElement).closest('button')) applyCrop()
          break
        case 'escape':
          if (dev.cropEdit) cancelCrop()
          else if (dev.picking) dev.setPicking(false)
          break
        case 'arrowleft':
        case 'arrowright': {
          if (isSliderLike(e.target) || dev.cropEdit) break
          const { order, currentId, select } = usePhotos.getState()
          const i = currentId ? order.indexOf(currentId) : -1
          const next = order[i + (key === 'arrowright' ? 1 : -1)]
          if (next) {
            e.preventDefault()
            select(next)
          }
          break
        }
        case 'tab': {
          e.preventDefault()
          const { hidden, toggleHidden } = ui
          const hide = !(hidden.left && hidden.right)
          if (hidden.left !== hide) toggleHidden('left')
          if (hidden.right !== hide) toggleHidden('right')
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
