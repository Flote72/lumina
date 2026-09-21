import { detectSky } from '@/core/retouch/sky'
import type { MaskBase } from '@/core/params/params'
import type { Preview } from '@/develop/local/previewImage'

const SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

let worker: Worker | null = null
let seq = 1
const pending = new Map<number, { resolve: (m: Uint8Array) => void; reject: (e: Error) => void; onStatus?: (s: string) => void }>()

function ensure() {
  if (worker) return worker
  worker = new Worker(new URL('./segment.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<{ req: number; ok?: boolean; mask?: Uint8Array; message?: string; status?: string }>) => {
    const m = e.data
    const p = pending.get(m.req)
    if (!p) return
    if (m.status) return p.onStatus?.(m.status)
    pending.delete(m.req)
    if (m.ok) p.resolve(m.mask!)
    else p.reject(new Error(m.message ?? 'AI segmentation failed'))
  }
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'AI worker crashed'))
    pending.clear()
    worker = null
  }
  return worker
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Resize the preview to 320×320 and normalise like the U²-Net reference pipeline. */
function preprocess(pv: Preview): Float32Array {
  const src = new OffscreenCanvas(pv.w, pv.h)
  src.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pv.rgba), pv.w, pv.h), 0, 0)
  const c = new OffscreenCanvas(SIZE, SIZE)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, 0, 0, SIZE, SIZE)
  const d = g.getImageData(0, 0, SIZE, SIZE).data
  let max = 1
  for (let i = 0; i < d.length; i += 4) max = Math.max(max, d[i]!, d[i + 1]!, d[i + 2]!)
  const n = SIZE * SIZE
  const out = new Float32Array(3 * n)
  for (let i = 0; i < n; i++)
    for (let ch = 0; ch < 3; ch++) out[ch * n + i] = (d[i * 4 + ch]! / max - MEAN[ch]!) / STD[ch]!
  return out
}

/** Subject mask via U²-Net-P. `onStatus`: 'model' while the model loads, 'run' during inference. */
export async function segmentSubject(pv: Preview, onStatus?: (s: string) => void): Promise<MaskBase> {
  const input = preprocess(pv)
  const w = ensure()
  const req = seq++
  const modelUrl = new URL(`${import.meta.env.BASE_URL}models/u2netp.onnx`, location.href).href
  const mask = await new Promise<Uint8Array>((resolve, reject) => {
    pending.set(req, { resolve, reject, onStatus })
    w.postMessage({ req, modelUrl, input, size: SIZE }, [input.buffer])
  })
  return { w: SIZE, h: SIZE, data: toBase64(mask), source: 'subject' }
}

/** Sky mask via the colour / position heuristic (no model). Returns null if no sky is found. */
export function segmentSky(pv: Preview): MaskBase | null {
  // work at ≤256px for speed
  const k = Math.min(1, 256 / Math.max(pv.w, pv.h))
  const w = Math.max(1, Math.round(pv.w * k))
  const h = Math.max(1, Math.round(pv.h * k))
  const src = new OffscreenCanvas(pv.w, pv.h)
  src.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pv.rgba), pv.w, pv.h), 0, 0)
  const c = new OffscreenCanvas(w, h)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, 0, 0, w, h)
  const m = detectSky(g.getImageData(0, 0, w, h).data, w, h)
  return m ? { w: m.w, h: m.h, data: toBase64(m.data), source: 'sky' } : null
}
