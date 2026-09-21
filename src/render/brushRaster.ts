import type { BrushStroke, MaskBase } from '@/core/params/params'

export const BRUSH_MAX_SIDE = 1536

export interface BrushBitmap {
  canvas: OffscreenCanvas
  w: number
  h: number
}

const sprites = new Map<string, OffscreenCanvas>()

/** White disc with a soft edge; `feather` 0..100 (0 = hard, 100 = fades from the centre). */
function sprite(diameter: number, feather: number): OffscreenCanvas {
  const d = Math.max(2, Math.round(diameter))
  const key = `${d}:${Math.round(feather)}`
  let c = sprites.get(key)
  if (c) return c
  c = new OffscreenCanvas(d, d)
  const g = c.getContext('2d')!
  const r = d / 2
  const inner = Math.min(0.98, Math.max(0, 1 - feather / 100))
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(inner, 'rgba(255,255,255,1)')
  // smoothstep-like fall-off
  grad.addColorStop(inner + (1 - inner) * 0.5, 'rgba(255,255,255,0.5)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, d, d)
  if (sprites.size > 64) sprites.clear()
  sprites.set(key, c)
  return c
}

/** Bitmap size for an image: long side ≤ BRUSH_MAX_SIDE, aspect preserved. */
export function brushSize(W: number, H: number): { w: number; h: number } {
  const k = Math.min(1, BRUSH_MAX_SIDE / Math.max(W, H))
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) }
}

/**
 * Paint brush strokes into an image-space bitmap. The mask value lives in the alpha channel.
 * Each stroke builds up with `flow` on its own layer, is capped by `density`, then added (or erased).
 */
export function rasterizeBrush(strokes: BrushStroke[], W: number, H: number, base?: MaskBase): BrushBitmap {
  const { w, h } = brushSize(W, H)
  const canvas = new OffscreenCanvas(w, h)
  const g = canvas.getContext('2d')!
  if (base) drawBase(g, base, w, h)
  const L = Math.max(w, h)

  for (const s of strokes) {
    const pts = s.points
    if (pts.length < 2) continue
    const r = Math.max(1, (s.size * L) / 2)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]! * w)
      maxX = Math.max(maxX, pts[i]! * w)
      minY = Math.min(minY, pts[i + 1]! * h)
      maxY = Math.max(maxY, pts[i + 1]! * h)
    }
    const bx = Math.max(0, Math.floor(minX - r))
    const by = Math.max(0, Math.floor(minY - r))
    const ex = Math.min(w, Math.ceil(maxX + r))
    const ey = Math.min(h, Math.ceil(maxY + r))
    if (ex <= bx || ey <= by) continue
    const layer = new OffscreenCanvas(ex - bx, ey - by)
    const lg = layer.getContext('2d')!
    lg.globalAlpha = Math.min(1, Math.max(0.02, s.flow / 100))
    const spr = sprite(r * 2, s.feather)
    const spacing = Math.max(1, r * 0.22)
    const stamp = (x: number, y: number) => lg.drawImage(spr, x - r - bx, y - r - by, r * 2, r * 2)

    let px = pts[0]! * w
    let py = pts[1]! * h
    stamp(px, py)
    for (let i = 2; i < pts.length; i += 2) {
      const x = pts[i]! * w
      const y = pts[i + 1]! * h
      const dist = Math.hypot(x - px, y - py)
      const n = Math.floor(dist / spacing)
      for (let k = 1; k <= n; k++) stamp(px + ((x - px) * k) / n, py + ((y - py) * k) / n)
      if (n === 0 && dist > 0) stamp(x, y)
      px = x
      py = y
    }

    g.save()
    g.globalAlpha = Math.min(1, Math.max(0, s.density / 100))
    g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    g.drawImage(layer, bx, by)
    g.restore()
  }
  return { canvas, w, h }
}

const baseCache = new Map<string, OffscreenCanvas>()

/** Paint the AI coverage bitmap (stretched over the whole image) with a slight blur for soft edges. */
function drawBase(g: OffscreenCanvasRenderingContext2D, base: MaskBase, w: number, h: number) {
  let src = baseCache.get(base.data)
  if (!src) {
    const bin = atob(base.data)
    const px = new Uint8ClampedArray(base.w * base.h * 4)
    for (let i = 0; i < base.w * base.h; i++) {
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 255
      px[i * 4 + 3] = bin.charCodeAt(i)
    }
    src = new OffscreenCanvas(base.w, base.h)
    src.getContext('2d')!.putImageData(new ImageData(px, base.w, base.h), 0, 0)
    if (baseCache.size > 6) baseCache.clear()
    baseCache.set(base.data, src)
  }
  g.save()
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  try {
    g.filter = `blur(${Math.max(1, Math.round(Math.max(w, h) / 600))}px)`
  } catch {
    /* filter unsupported: edges stay as sharp as the source resolution */
  }
  g.drawImage(src, 0, 0, w, h)
  g.restore()
}
