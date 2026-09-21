import { describe, expect, it } from 'vitest'
import { luminance } from './srgb'
import { hsvToRgb, wheelOffset, gradingActive } from './grading'
import { createDefaultParams } from '../params/params'
import { hueToMixerColor, rgbToHsl } from './hsl'

describe('hsl / mixer', () => {
  it('converts primaries', () => {
    expect(rgbToHsl(1, 0, 0)).toEqual([0, 1, 0.5])
    expect(rgbToHsl(0, 1, 0)[0]).toBe(120)
    expect(rgbToHsl(0, 0, 1)[0]).toBe(240)
    expect(rgbToHsl(0.5, 0.5, 0.5)[1]).toBe(0)
  })
  it('maps hues to the nearest mixer colour, wrapping around red', () => {
    expect(hueToMixerColor(10)).toBe('red')
    expect(hueToMixerColor(350)).toBe('red')
    expect(hueToMixerColor(200)).toBe('aqua')
    expect(hueToMixerColor(290)).toBe('magenta')
  })
})

describe('color grading', () => {
  it('hsv primaries', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual([1, 0, 0])
    expect(hsvToRgb(120, 1, 1)[1]).toBe(1)
  })
  it('chroma offset does not change luminance and is zero at s=0', () => {
    const o = wheelOffset({ h: 40, s: 80, l: 0 })
    expect(luminance(...o.chroma)).toBeCloseTo(0, 9)
    for (const v of wheelOffset({ h: 40, s: 0, l: 0 }).chroma) expect(v).toBeCloseTo(0, 12)
  })
  it('detects activity', () => {
    const g = createDefaultParams().grading
    expect(gradingActive(g)).toBe(false)
    g.shadows.s = 10
    expect(gradingActive(g)).toBe(true)
  })
})
