import { describe, expect, it } from 'vitest'
import { luminance } from './srgb'
import { solveWB, wbGains } from './whiteBalance'

describe('white balance', () => {
  it('is identity at 0/0', () => {
    const g = wbGains(0, 0)
    expect(luminance(...g)).toBeCloseTo(1, 6)
    expect(g[0]).toBeCloseTo(g[1], 6)
    expect(g[1]).toBeCloseTo(g[2], 6)
  })
  it('warms with positive temp', () => {
    const [r, , b] = wbGains(50, 0)
    expect(r).toBeGreaterThan(b)
  })
  it('positive tint reduces green', () => {
    const [r, g] = wbGains(0, 50)
    expect(g).toBeLessThan(r)
  })
  it('solve neutralises a picked colour', () => {
    const [r, g, b] = [0.3, 0.4, 0.5]
    const { temp, tint } = solveWB(r, g, b)
    const gains = wbGains(temp, tint)
    const out = [r * gains[0], g * gains[1], b * gains[2]]
    expect(out[0]! / out[1]!).toBeCloseTo(1, 1)
    expect(out[2]! / out[1]!).toBeCloseTo(1, 1)
  })
  it('clamps to slider range', () => {
    expect(solveWB(0.001, 0.5, 5).temp).toBe(100)
  })
})
