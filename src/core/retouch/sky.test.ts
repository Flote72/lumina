import { describe, expect, it } from 'vitest'
import { detectSky, skyScore } from './sky'

function image(w: number, h: number, f: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y)
      d.set([r, g, b, 255], (y * w + x) * 4)
    }
  return d
}
const at = (m: { w: number; data: Uint8Array }, x: number, y: number) => m.data[y * m.w + x]! / 255

describe('sky detection', () => {
  it('scores blue and bright-grey as sky, green/brown as not', () => {
    expect(skyScore(90, 140, 220)).toBeGreaterThan(0.6)
    expect(skyScore(215, 215, 220)).toBeGreaterThan(0.35)
    expect(skyScore(60, 130, 50)).toBe(0)
    expect(skyScore(140, 100, 70)).toBe(0)
  })
  it('finds blue sky above a green field', () => {
    const w = 120
    const h = 80
    const img = image(w, h, (x, y) => (y < 44 ? [80 + y, 130 + y, 225 - y] : [50, 120 + (x % 7), 45]))
    const m = detectSky(img, w, h)!
    expect(at(m, 60, 10)).toBeGreaterThan(0.9)
    expect(at(m, 60, 70)).toBeLessThan(0.05)
    expect(m.coverage).toBeGreaterThan(0.4)
    expect(m.coverage).toBeLessThan(0.65)
  })
  it('does not include a dark building inside the sky, nor sky-coloured pixels not connected to the top', () => {
    const w = 120
    const h = 80
    const img = image(w, h, (x, y) => {
      if (x > 40 && x < 70 && y > 20 && y < 60) return [60, 55, 50] // building
      if (y > 65) return [90, 140, 220] // a blue tarp at the bottom, not sky
      return [90, 140, 220]
    })
    const m = detectSky(img, w, h)!
    expect(at(m, 55, 40)).toBeLessThan(0.1)
    expect(at(m, 10, 10)).toBeGreaterThan(0.9)
  })
  it('returns null when there is no sky at the top', () => {
    const img = image(60, 40, () => [50, 120, 45])
    expect(detectSky(img, 60, 40)).toBeNull()
  })
})
