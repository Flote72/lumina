import { computeHistogram } from '@/core/histogram/histogram'
import { Renderer } from './Renderer'
import type { FromHost, RenderState, ToHost } from './protocol'

/**
 * Owns the renderer and image decoding. Runs inside a Web Worker (OffscreenCanvas) when available,
 * or on the main thread as a fallback — the message protocol is identical.
 */
export class RenderHost {
  private r: Renderer | null = null
  private pending: RenderState | null = null
  private scheduled = false
  private histTimer: ReturnType<typeof setTimeout> | null = null
  private lastHist = 0
  private loadToken = 0

  constructor(private post: (m: FromHost) => void) {}

  handle(msg: ToHost) {
    try {
      switch (msg.type) {
        case 'init':
          this.r = new Renderer(msg.canvas)
          this.post({ type: 'ready', maxTextureSize: this.r.maxTextureSize, floatTargets: this.r.floatTargets })
          break
        case 'resize':
          this.r?.resize(msg.w, msg.h)
          break
        case 'load':
          void this.load(msg.req, msg.id, msg.blob)
          break
        case 'unload':
          this.loadToken++
          this.pending = null
          this.r?.clearSource()
          break
        case 'render':
          this.pending = msg.state
          this.schedule()
          break
        case 'probeRGB':
          this.post({ type: 'probe', req: msg.req, rgb: this.r?.probeRGB(msg.x, msg.y) ?? null })
          break
        case 'probeWork':
          this.post({ type: 'probe', req: msg.req, rgb: this.r?.probeWork(msg.x, msg.y) ?? null })
          break
      }
    } catch (e) {
      this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  private async load(req: number, id: string, blob: Blob) {
    const token = ++this.loadToken
    const r = this.r
    if (!r) return this.post({ type: 'error', req, message: 'Renderer not initialised' })
    let bmp: ImageBitmap | null = null
    let scaled: ImageBitmap | null = null
    try {
      bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'default' })
      if (token !== this.loadToken) return void this.post({ type: 'error', req, message: 'cancelled' })
      const { width, height } = bmp
      const max = r.maxTextureSize
      let upload = bmp
      if (width > max || height > max) {
        const k = max / Math.max(width, height)
        scaled = await createImageBitmap(bmp, {
          resizeWidth: Math.floor(width * k),
          resizeHeight: Math.floor(height * k),
          resizeQuality: 'high',
        })
        upload = scaled
      }
      if (token !== this.loadToken) return void this.post({ type: 'error', req, message: 'cancelled' })
      r.setSource(upload, width, height)
      this.post({ type: 'loaded', req, id, width, height })
    } catch (e) {
      this.post({ type: 'error', req, message: e instanceof Error ? e.message : String(e) })
    } finally {
      // release decoded pixels immediately; the GPU texture is the only copy we keep
      bmp?.close()
      scaled?.close()
    }
  }

  private schedule() {
    if (this.scheduled) return
    this.scheduled = true
    const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame
    const run = () => {
      this.scheduled = false
      const s = this.pending
      this.pending = null
      if (!s || !this.r) return
      try {
        this.r.render(s)
        this.queueHistogram()
      } catch (e) {
        this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    }
    if (raf) raf(run)
    else setTimeout(run, 16)
  }

  private queueHistogram() {
    const now = performance.now()
    if (this.histTimer) clearTimeout(this.histTimer)
    if (now - this.lastHist > 100) this.sendHistogram()
    else this.histTimer = setTimeout(() => this.sendHistogram(), 120)
  }

  private sendHistogram() {
    this.histTimer = null
    this.lastHist = performance.now()
    const px = this.r?.readHistogramPixels()
    if (px) this.post({ type: 'hist', data: computeHistogram(px) })
  }
}
