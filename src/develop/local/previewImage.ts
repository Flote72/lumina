import { usePhotos } from '@/store/photos'

export interface Preview {
  id: string
  w: number
  h: number
  rgba: Uint8ClampedArray
  gray: Uint8ClampedArray
}

let cache: Preview | null = null
let pending: { id: string; p: Promise<Preview> } | null = null

/** ~1024px preview of the original, used to suggest spot sources and to find red pupils. */
export function getPreview(id: string): Promise<Preview> {
  if (cache?.id === id) return Promise.resolve(cache)
  if (pending?.id === id) return pending.p
  const p = (async () => {
    const photo = usePhotos.getState().photos[id]
    if (!photo) throw new Error('unknown photo')
    const file = await usePhotos.getState().getFile(id)
    const k = Math.min(1, 1024 / Math.max(photo.width, photo.height))
    const bmp = await createImageBitmap(file, { resizeWidth: Math.max(1, Math.round(photo.width * k)), resizeHeight: Math.max(1, Math.round(photo.height * k)), resizeQuality: 'medium' })
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(bmp, 0, 0)
    const d = g.getImageData(0, 0, bmp.width, bmp.height)
    bmp.close()
    const gray = new Uint8ClampedArray(d.width * d.height)
    for (let i = 0; i < gray.length; i++) gray[i] = 0.2126 * d.data[i * 4]! + 0.7152 * d.data[i * 4 + 1]! + 0.0722 * d.data[i * 4 + 2]!
    cache = { id, w: d.width, h: d.height, rgba: d.data, gray }
    return cache
  })()
  pending = { id, p }
  return p
}
