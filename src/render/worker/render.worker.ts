import { RenderHost } from '../host'
import type { FromHost, ToHost } from '../protocol'

const ctx = self as unknown as {
  postMessage(m: FromHost): void
  onmessage: ((e: MessageEvent<ToHost>) => void) | null
}
const host = new RenderHost((m) => ctx.postMessage(m))
ctx.onmessage = (e) => host.handle(e.data)
