import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'

function current() {
  const { currentId, params, photos } = usePhotos.getState()
  return currentId ? { id: currentId, params: params[currentId]!, photo: photos[currentId]! } : null
}

export function canCrop() {
  const c = current()
  return !!c && useDevelop.getState().loadedId === c.id
}

export function enterCrop() {
  const c = current()
  if (!c || !canCrop()) return
  useDevelop.getState().enterCrop({ ...c.params.crop })
}

export function applyCrop() {
  const d = useDevelop.getState()
  if (!d.cropEdit) return
  usePhotos.getState().commit('Crop')
  d.exitCrop()
}

export function cancelCrop() {
  const d = useDevelop.getState()
  if (!d.cropEdit) return
  const snap = d.cropSnapshot
  if (snap) usePhotos.getState().edit((p) => ({ ...p, crop: snap }))
  d.exitCrop()
}

export function toggleCrop() {
  if (useDevelop.getState().cropEdit) applyCrop()
  else enterCrop()
}
