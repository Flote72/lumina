import { MIXER_COLORS } from '../params/params'

/** Hue centres (degrees) of the eight mixer colours; kept in sync with the shader. */
export const MIXER_CENTERS = [0, 30, 60, 120, 180, 240, 270, 300] as const

/** RGB (0..1) → [hue°, sat, light] */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < 1e-9) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

/** Nearest mixer colour for a hue (used by the target tool). */
export function hueToMixerColor(hDeg: number) {
  let best = 0
  let bestD = Infinity
  MIXER_CENTERS.forEach((c, i) => {
    const d = Math.min(Math.abs(hDeg - c), 360 - Math.abs(hDeg - c))
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return MIXER_COLORS[best]!
}
