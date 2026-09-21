import { describe, expect, it } from 'vitest'
import { applyPatch, createDefaultParams } from '../params/params'
import { parseLrTemplate, parseLua } from './lrtemplate'
import { parseXmpPreset } from './xmp'

// Mirrors the structure of a real Lightroom 1/2 preset (values made up).
const TEMPLATE = `s = {
	id = "4D358B7B-0000",
	internalName = "My Negative",
	title = "My Negative",
	type = "Develop",
	value = {
		settings = {
			-- a comment
			Brightness = 50,
			Contrast = -49,
			ConvertToGrayscale = false,
			EnableCalibration = true,
			Exposure = 1.65,
			FillLight = 12,
			HighlightRecovery = 30,
			HueAdjustmentOrange = -14,
			ParametricLights = 99,
			Saturation = 17,
			Shadows = 0,
			SplitToningShadowHue = 220,
			SplitToningShadowSaturation = 40,
			Temperature = 5500,
			ToneCurve = {
				1,
				255,
				116,
				184,
				255,
				0,
			},
			WhiteBalance = "As Shot",
		},
		uuid = "AEB1623D",
	},
	version = 0,
}`

describe('parseLua', () => {
  it('parses nested tables, arrays, strings, numbers, booleans and comments', () => {
    const v = parseLua(`return { a = 1, b = "x\\"y", c = { 1, 2, 3 }, d = { e = true, f = nil }, ["g h"] = -2.5e1 } -- end`) as Record<string, unknown>
    expect(v.a).toBe(1)
    expect(v.b).toBe('x"y')
    expect(v.c).toEqual([1, 2, 3])
    expect(v.d).toEqual({ e: true, f: null })
    expect(v['g h']).toBe(-25)
  })
  it('throws on malformed input', () => {
    expect(() => parseLua('s = { a = ')).toThrow()
    expect(() => parseLua('s = { a = foo }')).toThrow()
  })
})

describe('parseLrTemplate', () => {
  const r = parseLrTemplate(TEMPLATE)
  const out = applyPatch(createDefaultParams(), r.patch)

  it('reads the title and flags legacy tone sliders', () => {
    expect(r.name).toBe('My Negative')
    expect(r.legacy).toBe(true)
  })
  it('maps legacy tone sliders to the current model', () => {
    expect(out.basic.exposure).toBeCloseTo(1.65, 2) // Brightness 50 = neutral
    expect(out.basic.contrast).toBe(-74) // legacy default contrast is 25
    expect(out.basic.highlights).toBe(-30) // HighlightRecovery
    expect(out.basic.shadows).toBe(12) // FillLight
    expect(out.basic.blacks).toBe(5) // legacy "Shadows" (Blacks) 0 vs default 5
    expect(out.basic.saturation).toBe(17)
  })
  it('turns the flat ToneCurve list into points', () => {
    expect(out.toneCurve.points.rgb).toHaveLength(3)
    expect(out.toneCurve.points.rgb[0]).toEqual({ x: 1 / 255, y: 1 })
    expect(out.toneCurve.points.rgb[2]).toEqual({ x: 1, y: 0 })
    expect(out.toneCurve.parametric.lights).toBe(99)
  })
  it('maps HSL and split toning; skips absolute temperature', () => {
    expect(out.mixer.hue.orange).toBe(-14)
    expect(out.grading.shadows).toMatchObject({ h: 220, s: 40 })
    expect(r.skipped).toContain('Temperature (absolute)')
    expect(r.skipped).not.toContain('EnableCalibration')
    expect(r.skipped).not.toContain('WhiteBalance')
  })
  it('rejects files that are not presets', () => {
    expect(() => parseLrTemplate('s = { hello = 1 }')).toThrow()
  })
})

describe('modern .xmp is not treated as legacy', () => {
  it('uses 2012 sliders when present', () => {
    const r = parseXmpPreset('crs:Contrast2012="+35" crs:Exposure2012="+0.5"')
    expect(r.legacy).toBe(false)
    expect(applyPatch(createDefaultParams(), r.patch).basic.contrast).toBe(35)
  })
})
