import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

/**
 * Salient-object ("subject") segmentation with U²-Net-P (ONNX) running on onnxruntime-web's CPU/WASM backend.
 * Single-threaded on purpose: multi-threaded WASM needs cross-origin isolation, which static hosting cannot provide.
 */
interface Req {
  req: number
  modelUrl: string
  /** normalized NCHW float input, 1×3×320×320 */
  input: Float32Array
  size: number
}
type Res = { req: number; ok: true; mask: Uint8Array } | { req: number; ok: false; message: string } | { req: number; status: string }

const ctx = self as unknown as { postMessage(m: Res): void; onmessage: ((e: MessageEvent<Req>) => void) | null }
let session: Promise<ort.InferenceSession> | null = null

function getSession(modelUrl: string, req: number) {
  session ??= (async () => {
    ctx.postMessage({ req, status: 'model' })
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = { wasm: wasmUrl }
    const buf = await (await fetch(modelUrl)).arrayBuffer()
    return ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
  })()
  session.catch(() => (session = null)) // allow a retry after a failed load
  return session
}

ctx.onmessage = async (e) => {
  const { req, modelUrl, input, size } = e.data
  try {
    const s = await getSession(modelUrl, req)
    ctx.postMessage({ req, status: 'run' })
    const out = await s.run({ [s.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, size, size]) })
    const pred = out[s.outputNames[0]!]!.data as Float32Array
    let lo = Infinity
    let hi = -Infinity
    for (const v of pred) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    const mask = new Uint8Array(size * size)
    const range = hi - lo || 1
    for (let i = 0; i < mask.length; i++) mask[i] = Math.round(((pred[i]! - lo) / range) * 255)
    ctx.postMessage({ req, ok: true, mask })
  } catch (err) {
    ctx.postMessage({ req, ok: false, message: err instanceof Error ? err.message : String(err) })
  }
}
