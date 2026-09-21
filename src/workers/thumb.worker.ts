/** Decodes an image off the main thread and returns its size plus a small JPEG thumbnail. */
interface Req {
  id: string
  blob: Blob
  size: number
}
type Res = { id: string; ok: true; width: number; height: number; thumb: Blob } | { id: string; ok: false; message: string }

const ctx = self as unknown as { postMessage(m: Res): void; onmessage: ((e: MessageEvent<Req>) => void) | null }

ctx.onmessage = async (e) => {
  const { id, blob, size } = e.data
  let bmp: ImageBitmap | null = null
  try {
    bmp = await createImageBitmap(blob)
    const k = Math.min(1, size / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * k))
    const h = Math.max(1, Math.round(bmp.height * k))
    const c = new OffscreenCanvas(w, h)
    const g = c.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.drawImage(bmp, 0, 0, w, h)
    const thumb = await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 })
    ctx.postMessage({ id, ok: true, width: bmp.width, height: bmp.height, thumb })
  } catch (err) {
    ctx.postMessage({ id, ok: false, message: err instanceof Error ? err.message : String(err) })
  } finally {
    bmp?.close()
  }
}
