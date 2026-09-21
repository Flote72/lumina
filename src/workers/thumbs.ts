export interface ThumbResult {
  width: number
  height: number
  thumb: Blob
}

type Res = { id: string; ok: true; width: number; height: number; thumb: Blob } | { id: string; ok: false; message: string }

const POOL = Math.min(3, Math.max(1, (navigator.hardwareConcurrency ?? 4) - 1))
const workers: Worker[] = []
const idle: Worker[] = []
const queue: { id: string; blob: Blob; size: number; resolve: (r: ThumbResult) => void; reject: (e: Error) => void }[] = []
const inflight = new Map<Worker, (typeof queue)[number]>()

function pump() {
  while (queue.length) {
    let w = idle.pop()
    if (!w && workers.length < POOL) {
      w = new Worker(new URL('./thumb.worker.ts', import.meta.url), { type: 'module' })
      const worker = w
      worker.onmessage = (e: MessageEvent<Res>) => {
        const job = inflight.get(worker)
        inflight.delete(worker)
        idle.push(worker)
        if (job) {
          const r = e.data
          if (r.ok) job.resolve({ width: r.width, height: r.height, thumb: r.thumb })
          else job.reject(new Error(r.message))
        }
        pump()
      }
      workers.push(worker)
    }
    if (!w) return
    const job = queue.shift()!
    inflight.set(w, job)
    w.postMessage({ id: job.id, blob: job.blob, size: job.size })
  }
}

/** Decode + thumbnail in a small worker pool. */
export function makeThumbnail(id: string, blob: Blob, size = 256): Promise<ThumbResult> {
  return new Promise((resolve, reject) => {
    queue.push({ id, blob, size, resolve, reject })
    pump()
  })
}
