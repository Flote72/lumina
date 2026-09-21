import { applyRatio, cropToFrameRect, fitInside, flipRatio, frameRectToCrop, ratioValue } from '@/core/geometry/crop'
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

/** Set the straighten angle, shrinking the crop so it never leaves the image. */
export function setCropAngle(angle: number) {
  const c = current()
  if (!c) return
  const { width: W, height: H } = c.photo
  usePhotos.getState().edit((p) => {
    const next = fitInside(cropToFrameRect(p.crop, W, H), angle, W, H)
    return { ...p, crop: frameRectToCrop(next, angle, p.crop.ratio, W, H) }
  })
}

/** Swap landscape/portrait of the locked crop ratio (X key). */
export function flipCropRatio() {
  const c = current()
  if (!c) return
  const { width: W, height: H } = c.photo
  const base = c.params.crop.ratio === 'original' ? `${W}:${H}` : c.params.crop.ratio
  if (base === 'free') return
  const ratio = flipRatio(base)
  usePhotos.getState().edit((p) => {
    const r = cropToFrameRect(p.crop, W, H)
    const v = ratioValue(ratio, W, H)
    return { ...p, crop: frameRectToCrop(v ? applyRatio(r, v, p.crop.angle, W, H) : r, p.crop.angle, ratio, W, H) }
  })
  usePhotos.getState().commit('Crop')
}
