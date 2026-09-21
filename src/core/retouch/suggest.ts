/**
 * Automatic source suggestion for Spot Removal, and red-eye radius estimation.
 * Both work on a small greyscale / RGBA preview of the photo and return normalized coordinates.
 */

export interface Gray {
  data: Uint8ClampedArray | Uint8Array
  w: number
  h: number
}

const at = (g: Gray, x: number, y: number) => g.data[Math.min(g.h - 1, Math.max(0, Math.round(y))) * g.w + Math.min(g.w - 1, Math.max(0, Math.round(x)))]!

/** Sample points on a ring around (cx, cy). */
function ring(g: Gray, cx: number, cy: number, r: number, n = 16): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push(at(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r))
  }
  return out
}

function ringPair(g: Gray, cx: number, cy: number, r: number): number[] {
  return [...ring(g, cx, cy, r * 1.3), ...ring(g, cx, cy, r * 1.9)]
}

/**
 * Pick where to clone/heal from: the candidate whose surroundings best match the blemish's surroundings
 * (low colour difference), preferring smooth (texture-free) sources and staying inside the image.
 * `x`,`y`,`radius` are normalized (radius = fraction of the long side).
 */
export function suggestSource(g: Gray, x: number, y: number, radius: number): { x: number; y: number } {
  const L = Math.max(g.w, g.h)
  const px = x * g.w
  const py = y * g.h
  const r = Math.max(2, radius * L)
  const target = ringPair(g, px, py, r)
  let best = { x: px + r * 3, y: py, score: Infinity }
  const dists = [2.6, 3.6, 5]
  for (const dm of dists) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const cx = px + Math.cos(a) * r * dm
      const cy = py + Math.sin(a) * r * dm
      if (cx - r < 0 || cy - r < 0 || cx + r >= g.w || cy + r >= g.h) continue
      const cand = ringPair(g, cx, cy, r)
      let ssd = 0
      for (let i = 0; i < cand.length; i++) ssd += (cand[i]! - target[i]!) ** 2
      // penalise busy sources: variance of the candidate's own ring
      const mean = cand.reduce((s, v) => s + v, 0) / cand.length
      const varr = cand.reduce((s, v) => s + (v - mean) ** 2, 0) / cand.length
      const score = ssd / cand.length + varr * 0.5 + dm * 2
      if (score < best.score) best = { x: cx, y: cy, score }
    }
  }
  return { x: Math.min(1, Math.max(0, best.x / g.w)), y: Math.min(1, Math.max(0, best.y / g.h)) }
}

export interface Rgba {
  data: Uint8ClampedArray | Uint8Array
  w: number
  h: number
}

const redness = (d: Uint8ClampedArray | Uint8Array, i: number) => {
  const r = d[i]!
  const gb = (d[i + 1]! + d[i + 2]!) / 2
  return r > 60 && r > gb * 1.7 + 20
}

/**
 * Grow a region of "red" pixels from a click and return its centre and radius (normalized, radius relative to the
 * long side). Returns null when there is no red near the click.
 */
export function estimateRedEye(img: Rgba, x: number, y: number): { x: number; y: number; radius: number } | null {
  const { data, w, h } = img
  const L = Math.max(w, h)
  const sx = Math.round(x * w)
  const sy = Math.round(y * h)
  // find the nearest red pixel within a small window
  let start = -1
  const win = Math.max(3, Math.round(L * 0.02))
  let bestD = Infinity
  for (let dy = -win; dy <= win; dy++) {
    for (let dx = -win; dx <= win; dx++) {
      const xx = sx + dx
      const yy = sy + dy
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      if (redness(data, (yy * w + xx) * 4) && dx * dx + dy * dy < bestD) {
        bestD = dx * dx + dy * dy
        start = yy * w + xx
      }
    }
  }
  if (start < 0) return null
  const seen = new Uint8Array(w * h)
  const stack = [start]
  seen[start] = 1
  let minX = w
  let maxX = 0
  let minY = h
  let maxY = 0
  let count = 0
  const limit = Math.round(L * L * 0.02)
  while (stack.length && count < limit) {
    const p = stack.pop()!
    const px = p % w
    const py = (p - px) / w
    count++
    minX = Math.min(minX, px)
    maxX = Math.max(maxX, px)
    minY = Math.min(minY, py)
    maxY = Math.max(maxY, py)
    for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = px + ddx
      const ny = py + ddy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const q = ny * w + nx
      if (!seen[q] && redness(data, q * 4)) {
        seen[q] = 1
        stack.push(q)
      }
    }
  }
  const radius = (Math.max(maxX - minX, maxY - minY) / 2 + 1) * 1.25
  return { x: (minX + maxX + 1) / 2 / w, y: (minY + maxY + 1) / 2 / h, radius: radius / L }
}
