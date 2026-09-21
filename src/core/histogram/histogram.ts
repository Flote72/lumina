export interface HistogramData {
  r: Uint32Array
  g: Uint32Array
  b: Uint32Array
  l: Uint32Array
}

/** Histogram of straight RGBA8 pixels; fully transparent pixels are ignored. */
export function computeHistogram(rgba: Uint8Array | Uint8ClampedArray): HistogramData {
  const r = new Uint32Array(256)
  const g = new Uint32Array(256)
  const b = new Uint32Array(256)
  const l = new Uint32Array(256)
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] as number) < 128) continue
    const R = rgba[i] as number
    const G = rgba[i + 1] as number
    const B = rgba[i + 2] as number
    r[R]!++
    g[G]!++
    b[B]!++
    l[Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B)]!++
  }
  return { r, g, b, l }
}
