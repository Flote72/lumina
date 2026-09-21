import { runExport, type ExportJob, type ExportResult } from './exporter'

type Req = { req: number; job: ExportJob }
type Res = { req: number; ok: true; result: ExportResult } | { req: number; ok: false; message: string } | { req: number; progress: number }

const ctx = self as unknown as { postMessage(m: Res): void; onmessage: ((e: MessageEvent<Req>) => void) | null }

// Jobs run one after another; the queue keeps GPU memory bounded.
let chain: Promise<void> = Promise.resolve()

ctx.onmessage = (e) => {
  const { req, job } = e.data
  chain = chain.then(async () => {
    try {
      const result = await runExport(job, (progress) => ctx.postMessage({ req, progress }))
      ctx.postMessage({ req, ok: true, result })
    } catch (err) {
      ctx.postMessage({ req, ok: false, message: err instanceof Error ? err.message : String(err) })
    }
  })
}
