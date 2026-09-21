import { describe, expect, it } from 'vitest'
import { computeHistogram } from './histogram'

describe('computeHistogram', () => {
  it('counts channels and luminance, skipping transparent pixels', () => {
    const px = new Uint8Array([255, 0, 0, 255, 255, 255, 255, 255, 9, 9, 9, 0])
    const h = computeHistogram(px)
    expect(h.r[255]).toBe(2)
    expect(h.g[0]).toBe(1)
    expect(h.g[255]).toBe(1)
    expect(h.l[255]).toBe(1)
    expect(h.l[54]).toBe(1) // 0.2126*255
    expect(h.r[9]).toBe(0)
  })
})
