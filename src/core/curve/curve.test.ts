import { describe, expect, it } from 'vitest'
import { createDefaultParams } from '../params/params'
import { buildCurveLUT, isIdentityCurve, monotoneSpline, parametricPoints } from './curve'

describe('monotoneSpline', () => {
  it('passes through control points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.5 },
      { x: 0.7, y: 0.6 },
      { x: 1, y: 1 },
    ]
    const f = monotoneSpline(pts)
    for (const p of pts) expect(f(p.x)).toBeCloseTo(p.y, 9)
  })
  it('is monotone for monotone data', () => {
    const f = monotoneSpline([
      { x: 0, y: 0 },
      { x: 0.1, y: 0.6 },
      { x: 0.5, y: 0.62 },
      { x: 0.9, y: 0.95 },
      { x: 1, y: 1 },
    ])
    let prev = -1
    for (let i = 0; i <= 1000; i++) {
      const y = f(i / 1000)
      expect(y).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = y
    }
  })
  it('does not overshoot on a plateau', () => {
    const f = monotoneSpline([
      { x: 0, y: 0 },
      { x: 0.4, y: 0.5 },
      { x: 0.6, y: 0.5 },
      { x: 1, y: 1 },
    ])
    for (let x = 0.4; x <= 0.6; x += 0.01) expect(f(x)).toBeCloseTo(0.5, 9)
    for (let i = 0; i <= 100; i++) {
      const y = f(i / 100)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })
  it('handles unsorted / duplicate x and degenerate input', () => {
    const f = monotoneSpline([
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      { x: 0, y: 0.1 },
    ])
    expect(f(0)).toBeCloseTo(0.1, 9)
    expect(f(1)).toBe(1)
    expect(monotoneSpline([])(0.3)).toBeCloseTo(0.3)
  })
})

describe('curve LUT', () => {
  it('default params give an identity LUT', () => {
    const tc = createDefaultParams().toneCurve
    expect(isIdentityCurve(tc)).toBe(true)
    const lut = buildCurveLUT(tc)
    for (let i = 0; i < 256; i++) {
      expect(lut[i * 4]).toBe(i)
      expect(lut[i * 4 + 1]).toBe(i)
      expect(lut[i * 4 + 2]).toBe(i)
    }
  })
  it('parametric lights slider brightens upper mids and stays monotone', () => {
    const tc = createDefaultParams().toneCurve
    tc.parametric.lights = 60
    const lut = buildCurveLUT(tc)
    expect(lut[160 * 4]!).toBeGreaterThan(160)
    for (let i = 1; i < 256; i++) expect(lut[i * 4]!).toBeGreaterThanOrEqual(lut[(i - 1) * 4]!)
    expect(lut[0]).toBe(0)
    expect(lut[255 * 4]).toBe(255)
  })
  it('a single channel curve only affects that channel', () => {
    const tc = createDefaultParams().toneCurve
    tc.points.r = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.7 },
      { x: 1, y: 1 },
    ]
    const lut = buildCurveLUT(tc)
    expect(lut[128 * 4]!).toBeGreaterThan(128)
    expect(lut[128 * 4 + 1]).toBe(128)
    expect(parametricPoints(tc.parametric)).toHaveLength(6)
  })
})
