/**
 * Heuristic sky detection (NOT a neural network): sky is bluish or bright-and-grey, smooth, and connected to the
 * top of the frame. We score every pixel by colour, then grow a region from sky-like pixels in the top rows.
 * Works well for clear / evenly clouded skies; busy or sunset skies may need brush refinement.
 */

export interface SkyMask {
  w: number
  h: number
  /** 0..255 coverage */
  data: Uint8Array
  /** fraction of the image covered (0..1) */
  coverage: number
}

/** How sky-like a pixel colour is (0..1). Inputs 0..255 sRGB. */
export function skyScore(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const sat = max === 0 ? 0 : (max - min) / max
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // blue-dominant (clear sky, incl. deep blue and pale blue)
  const blue = b >= r + 6 && b >= g - 4 && b > 70 ? Math.min(1, (b - r) / 40 + 0.4) : 0
  // bright, low-saturation (clouds, overcast, haze)
  const grey = lum > 150 && sat < 0.2 ? Math.min(1, (lum - 150) / 60 + 0.3) : 0
  return Math.max(blue, grey)
}

/**
 * @param rgba straight RGBA8 pixels
 * @returns a soft mask, or null when no sky reaches the top of the image
 */
export function detectSky(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): SkyMask | null {
  const n = w * h
  const score = new Float32Array(n)
  const lumA = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4]!
    const g = rgba[i * 4 + 1]!
    const b = rgba[i * 4 + 2]!
    score[i] = skyScore(r, g, b)
    lumA[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  // texture: sky is smooth, foliage / buildings are not
  const smooth = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const gx = Math.abs(lumA[y * w + Math.min(w - 1, x + 1)]! - lumA[y * w + Math.max(0, x - 1)]!)
      const gy = Math.abs(lumA[Math.min(h - 1, y + 1) * w + x]! - lumA[Math.max(0, y - 1) * w + x]!)
      smooth[i] = Math.max(gx, gy) < 26 ? 1 : 0
    }
  }
  const ok = (i: number) => score[i]! >= 0.35 && smooth[i] === 1
  const region = new Uint8Array(n)
  const stack: number[] = []
  const topRows = Math.max(1, Math.round(h * 0.06))
  for (let y = 0; y < topRows; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (ok(i)) {
        region[i] = 1
        stack.push(i)
      }
    }
  if (!stack.length) return null
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const y = (i - x) / w
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (!region[j] && ok(j)) {
        region[j] = 1
        stack.push(j)
      }
    }
  }
  // soften: two box-blur passes of radius 2 turn the binary region into a feathered mask
  let cur = Float32Array.from(region)
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(n)
    const r = 2
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0
        let c = 0
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            s += cur[yy * w + xx]!
            c++
          }
        tmp[y * w + x] = s / c
      }
    cur = tmp
  }
  const data = new Uint8Array(n)
  let cov = 0
  for (let i = 0; i < n; i++) {
    data[i] = Math.round(Math.min(1, cur[i]! * 1.15) * 255)
    cov += data[i]! / 255
  }
  const coverage = cov / n
  return coverage < 0.005 ? null : { w, h, data, coverage }
}
