import { describe, expect, it } from 'vitest'
import { estimateTilt } from './autoLevel'

/** Soft (anti-aliased) parallel lines rotated by `deg` clockwise, like real photo edges. */
function lines(deg: number, w = 200, h = 200) {
  const g = new Uint8ClampedArray(w * h)
  const a = (deg * Math.PI) / 180
  const pitch = 30
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const across = -(x - w / 2) * Math.sin(a) + (y - h / 2) * Math.cos(a)
      const d = ((across % pitch) + pitch) % pitch
      const dist = Math.min(d, pitch - d)
      g[y * w + x] = 20 + 210 * Math.exp((-dist * dist) / (2 * 2.2 * 2.2))
    }
  }
  return g
}

describe('estimateTilt', () => {
  it('returns ~0 for level lines', () => {
    expect(Math.abs(estimateTilt(lines(0), 200, 200)!)).toBeLessThan(0.6)
  })
  it('measures tilt magnitude and returns the opposite correction', () => {
    const t = estimateTilt(lines(4), 200, 200)!
    expect(Math.abs(Math.abs(t) - 4)).toBeLessThan(0.8)
    expect(Math.sign(t)).toBe(-Math.sign(estimateTilt(lines(-4), 200, 200)!))
  })
  it('returns null without structure', () => {
    expect(estimateTilt(new Uint8ClampedArray(100 * 100).fill(100), 100, 100)).toBeNull()
  })
})
