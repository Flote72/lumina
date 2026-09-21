import { describe, expect, it } from 'vitest'
import { estimateRedEye, suggestSource, type Gray, type Rgba } from './suggest'

function gray(w: number, h: number, f: (x: number, y: number) => number): Gray {
  const data = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x, y)
  return { data, w, h }
}

describe('suggestSource', () => {
  it('avoids a busy area and picks similar smooth surroundings', () => {
    // left half smooth mid-grey (blemish in the middle of it); right half is high-contrast noise
    const g = gray(200, 100, (x, y) => (x < 100 ? 120 : (x * 7 + y * 13) % 2 ? 250 : 5))
    const s = suggestSource(g, 0.25, 0.5, 0.03)
    expect(s.x).toBeLessThan(0.5)
    expect(Math.hypot((s.x - 0.25) * 200, (s.y - 0.5) * 100)).toBeGreaterThan(6)
  })
  it('prefers a source with a similar background (gradient continues)', () => {
    const g = gray(200, 100, (x) => 40 + x) // horizontal gradient
    const s = suggestSource(g, 0.5, 0.5, 0.03)
    // vertical neighbours have the same gradient rows, horizontal ones do not
    expect(Math.abs(s.x - 0.5)).toBeLessThan(0.05)
    expect(Math.abs(s.y - 0.5)).toBeGreaterThan(0.1)
  })
  it('stays inside the image near the borders', () => {
    const g = gray(100, 100, () => 100)
    const s = suggestSource(g, 0.02, 0.02, 0.03)
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.y).toBeGreaterThanOrEqual(0)
    expect(s.x).toBeLessThanOrEqual(1)
  })
})

describe('estimateRedEye', () => {
  const img = (): Rgba => {
    const w = 100
    const h = 100
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) data.set([120, 110, 100, 255], i * 4)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (Math.hypot(x - 40, y - 60) <= 6) data.set([220, 30, 30, 255], (y * w + x) * 4)
    return { data, w, h }
  }
  it('finds the centre and radius of a red pupil from a nearby click', () => {
    const r = estimateRedEye(img(), 0.43, 0.58)!
    expect(r.x).toBeCloseTo(0.4, 1)
    expect(r.y).toBeCloseTo(0.6, 1)
    expect(r.radius * 100).toBeGreaterThan(5)
    expect(r.radius * 100).toBeLessThan(11)
  })
  it('returns null when there is no red', () => {
    expect(estimateRedEye(img(), 0.9, 0.1)).toBeNull()
  })
})
