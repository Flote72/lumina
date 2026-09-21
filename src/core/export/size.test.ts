import { describe, expect, it } from 'vitest'
import { MAX_OUTPUT_SIDE, outputSharpenAmount, outputSize, tiles, watermarkOrigin, type ResizeSettings } from './size'

const R = (o: Partial<ResizeSettings> = {}): ResizeSettings => ({ mode: 'original', longEdge: 2048, percent: 50, width: 0, height: 0, noUpscale: false, ...o })

describe('outputSize', () => {
  it('keeps the original size', () => {
    expect(outputSize(6000, 4000, R())).toMatchObject({ w: 6000, h: 4000 })
  })
  it('long edge, percent, dimensions keep aspect ratio', () => {
    expect(outputSize(6000, 4000, R({ mode: 'longEdge', longEdge: 3000 }))).toMatchObject({ w: 3000, h: 2000 })
    expect(outputSize(4000, 6000, R({ mode: 'longEdge', longEdge: 3000 }))).toMatchObject({ w: 2000, h: 3000 })
    expect(outputSize(6000, 4000, R({ mode: 'percent', percent: 25 }))).toMatchObject({ w: 1500, h: 1000 })
    expect(outputSize(6000, 4000, R({ mode: 'dimensions', width: 1200, height: 1200 }))).toMatchObject({ w: 1200, h: 800 })
    expect(outputSize(6000, 4000, R({ mode: 'dimensions', width: 0, height: 500 }))).toMatchObject({ w: 750, h: 500 })
  })
  it('noUpscale never enlarges', () => {
    expect(outputSize(1000, 800, R({ mode: 'longEdge', longEdge: 4000, noUpscale: true }))).toMatchObject({ w: 1000, h: 800 })
    expect(outputSize(1000, 800, R({ mode: 'longEdge', longEdge: 4000 }))).toMatchObject({ w: 4000, h: 3200 })
  })
  it('enforces hard limits', () => {
    const o = outputSize(4000, 3000, R({ mode: 'percent', percent: 400 }))
    expect(Math.max(o.w, o.h)).toBeLessThanOrEqual(MAX_OUTPUT_SIDE)
    expect(o.w * o.h).toBeLessThanOrEqual(200_000_000 + 1e5)
  })
})

describe('tiles', () => {
  it('covers the image exactly without overlap', () => {
    const t = tiles(5000, 3000, 2048)
    expect(t).toHaveLength(3 * 2)
    expect(t.reduce((a, r) => a + r.w * r.h, 0)).toBe(5000 * 3000)
    expect(t[2]).toEqual({ x: 4096, y: 0, w: 904, h: 2048 })
  })
  it('single tile for small images', () => {
    expect(tiles(100, 50, 2048)).toEqual([{ x: 0, y: 0, w: 100, h: 50 }])
  })
})

describe('watermarkOrigin / sharpening', () => {
  it('places boxes on a 3×3 grid', () => {
    expect(watermarkOrigin('tl', 1000, 800, 100, 50, 20)).toEqual({ x: 20, y: 20 })
    expect(watermarkOrigin('br', 1000, 800, 100, 50, 20)).toEqual({ x: 880, y: 730 })
    expect(watermarkOrigin('mc', 1000, 800, 100, 50, 20)).toEqual({ x: 450, y: 375 })
  })
  it('sharpen amounts grow with strength, none = 0', () => {
    expect(outputSharpenAmount('none', 'high')).toBe(0)
    expect(outputSharpenAmount('screen', 'high')).toBeGreaterThan(outputSharpenAmount('screen', 'low'))
    expect(outputSharpenAmount('print', 'standard')).toBeGreaterThan(outputSharpenAmount('screen', 'standard'))
  })
})
