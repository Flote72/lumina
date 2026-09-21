import type { HistogramData } from '@/core/histogram/histogram'
import { RenderHost } from './host'
import type { FromHost, RenderState, ToHost } from './protocol'

type Pending = { resolve: (v: never) => void; reject: (e: Error) => void }

/**
 * Main-thread handle to the renderer. The canvas is created once here (not by React) because
 * `transferControlToOffscreen` can only be called once per element and React StrictMode remounts.
 */
class RenderClient {
  readonly canvas: HTMLCanvasElement = document.createElement('canvas')
  private worker: Worker | null = null
  private host: RenderHost | null = null
  private req = 1
  private pending = new Map<number, Pending>()
  private started = false
  private lastSize = ''
  onHistogram: (h: HistogramData) => void = () => {}
  onError: (msg: string) => void = () => {}
  mode: 'worker' | 'main' | 'none' = 'none'

  constructor() {
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  }

  private start() {
    if (this.started) return
    this.started = true
    const onMsg = (m: FromHost) => this.onMessage(m)
    if (typeof OffscreenCanvas !== 'undefined' && 'transferControlToOffscreen' in this.canvas && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./worker/render.worker.ts', import.meta.url), { type: 'module' })
        this.worker.onmessage = (e: MessageEvent<FromHost>) => onMsg(e.data)
        this.worker.onerror = (e) => this.onError(e.message)
        const off = this.canvas.transferControlToOffscreen()
        this.mode = 'worker'
        this.send({ type: 'init', canvas: off }, [off])
        return
      } catch {
        this.worker = null
      }
    }
    // Fallback: same host on the main thread
    this.mode = 'main'
    this.host = new RenderHost(onMsg)
    this.send({ type: 'init', canvas: this.canvas })
  }

  private send(msg: ToHost, transfer?: Transferable[]) {
    if (this.worker) this.worker.postMessage(msg, transfer ?? [])
    else this.host?.handle(msg)
  }

  private onMessage(m: FromHost) {
    switch (m.type) {
      case 'loaded': {
        const p = this.pending.get(m.req)
        this.pending.delete(m.req)
        p?.resolve({ width: m.width, height: m.height } as never)
        break
      }
      case 'probe': {
        const p = this.pending.get(m.req)
        this.pending.delete(m.req)
        p?.resolve(m.rgb as never)
        break
      }
      case 'hist':
        this.onHistogram(m.data)
        break
      case 'error': {
        const p = m.req !== undefined ? this.pending.get(m.req) : undefined
        if (p) {
          this.pending.delete(m.req!)
          p.reject(new Error(m.message))
        } else this.onError(m.message)
        break
      }
    }
  }

  private call<T>(build: (req: number) => ToHost): Promise<T> {
    this.start()
    const req = this.req++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req, { resolve: resolve as (v: never) => void, reject })
      this.send(build(req))
    })
  }

  resize(w: number, h: number) {
    this.start()
    const key = `${w}x${h}`
    if (key === this.lastSize) return
    this.lastSize = key
    this.send({ type: 'resize', w, h })
  }

  load(id: string, blob: Blob) {
    return this.call<{ width: number; height: number }>((req) => ({ type: 'load', req, id, blob }))
  }
  unload() {
    this.start()
    this.send({ type: 'unload' })
  }
  render(state: RenderState) {
    this.start()
    this.send({ type: 'render', state })
  }
  probeRGB(x: number, y: number) {
    return this.call<[number, number, number] | null>((req) => ({ type: 'probeRGB', req, x, y }))
  }
  probeWork(x: number, y: number) {
    return this.call<[number, number, number] | null>((req) => ({ type: 'probeWork', req, x, y }))
  }
}

export const renderClient = new RenderClient()
