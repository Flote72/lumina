/**
 * Auto Level: estimate the tilt of the dominant near-horizontal / near-vertical edges.
 * Works on a small greyscale image; returns the clockwise correction angle in degrees (or null if unsure).
 */
export function estimateTilt(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, maxDeg = 10): number | null {
  const bin = 0.25
  const n = Math.round((2 * maxDeg) / bin) + 1
  const hist = new Float64Array(n)
  let total = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        -gray[i - w - 1]! - 2 * gray[i - 1]! - gray[i + w - 1]! + gray[i - w + 1]! + 2 * gray[i + 1]! + gray[i + w + 1]!
      const gy =
        -gray[i - w - 1]! - 2 * gray[i - w]! - gray[i - w + 1]! + gray[i + w - 1]! + 2 * gray[i + w]! + gray[i + w + 1]!
      const mag = Math.hypot(gx, gy)
      if (mag < 80) continue
      // edge direction is perpendicular to the gradient; fold into (-45°, 45°] around the nearest axis
      let a = (Math.atan2(gy, gx) * 180) / Math.PI // gradient angle
      a = ((((a % 90) + 90) % 90) + 45) % 90 - 45
      if (Math.abs(a) > maxDeg) continue
      hist[Math.round((a + maxDeg) / bin)]! += mag
      total += mag
    }
  }
  if (total <= 0) return null
  // smooth and take the peak
  let best = -1
  let bestV = 0
  for (let i = 0; i < n; i++) {
    const v = (hist[i - 2] ?? 0) + (hist[i - 1] ?? 0) * 2 + hist[i]! * 3 + (hist[i + 1] ?? 0) * 2 + (hist[i + 2] ?? 0)
    if (v > bestV) {
      bestV = v
      best = i
    }
  }
  // require a clear peak (not a flat histogram)
  if (best < 0 || bestV / 9 < (total / n) * 2.5) return null
  const tilt = best * bin - maxDeg
  return Math.round(-tilt * 10) / 10
}
