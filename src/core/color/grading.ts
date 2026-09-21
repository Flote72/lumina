import type { GradingParams, Wheel } from '../params/params'
import { luminance } from './srgb'

/** HSV (h°, s 0..1, v 0..1) → RGB */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5), f(3), f(1)]
}

/**
 * Colour shift for one wheel: a chroma offset with zero luminance change (so hue/sat never alter brightness)
 * plus a separate luminance amount. Values are added in the sRGB-encoded domain by the shader.
 */
export function wheelOffset(w: Wheel): { chroma: [number, number, number]; lum: number } {
  const [r, g, b] = hsvToRgb(w.h, 1, 1)
  const y = luminance(r, g, b)
  const k = (w.s / 100) * 0.3
  return { chroma: [(r - y) * k, (g - y) * k, (b - y) * k], lum: (w.l / 100) * 0.3 }
}

export function gradingActive(g: GradingParams): boolean {
  return [g.shadows, g.midtones, g.highlights, g.global].some((w) => w.s !== 0 || w.l !== 0)
}
