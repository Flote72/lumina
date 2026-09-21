import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'

/** True once the current photo is loaded in the renderer (controls are disabled before that). */
export function usePanelReady() {
  const id = usePhotos((s) => s.currentId)
  return useDevelop((s) => s.loadedId) === id && !!id
}
