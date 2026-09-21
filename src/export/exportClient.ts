import type { ExportFormat, ExportJob, ExportResult } from './exporter'

type Res = { req: number; ok: true; result: ExportResult } | { req: number; ok: false; message: string } | { req: number; progress: number }

let worker: Worker | null = null
let seq = 1
const pending = new Map<number, { resolve: (r: ExportResult) => void; reject: (e: Error) => void; onProgress?: (f: number) => void }>()

function ensure() {
  if (worker) return worker
  worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<Res>) => {
    const m = e.data
    const p = pending.get(m.req)
    if (!p) return
    if ('progress' in m) return p.onProgress?.(m.progress)
    pending.delete(m.req)
    if (m.ok) p.resolve(m.result)
    else p.reject(new Error(m.message))
  }
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Export worker crashed'))
    pending.clear()
    worker = null
  }
  return worker
}

export function exportPhoto(job: ExportJob, onProgress?: (f: number) => void): Promise<ExportResult> {
  const w = ensure()
  const req = seq++
  return new Promise((resolve, reject) => {
    pending.set(req, { resolve, reject, onProgress })
    w.postMessage({ req, job })
  })
}

/** Stop everything in flight (the next export starts a fresh worker). */
export function cancelExports() {
  worker?.terminate()
  worker = null
  for (const p of pending.values()) p.reject(new Error('cancelled'))
  pending.clear()
}

export interface ExportSupport {
  worker: boolean
  formats: Record<ExportFormat, boolean>
  p3: boolean
}

/** What this browser can actually produce (AVIF encoding and Display P3 canvases vary). */
export async function detectExportSupport(): Promise<ExportSupport> {
  const worker = typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined'
  const canEncode = async (type: string) => {
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 2
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, 0.8))
      return blob?.type === type
    } catch {
      return false
    }
  }
  let p3 = false
  try {
    const g = document.createElement('canvas').getContext('2d', { colorSpace: 'display-p3' })
    p3 = g?.getContextAttributes?.().colorSpace === 'display-p3'
  } catch {
    /* unsupported */
  }
  return { worker, formats: { jpeg: true, png: true, webp: await canEncode('image/webp'), avif: await canEncode('image/avif') }, p3 }
}
