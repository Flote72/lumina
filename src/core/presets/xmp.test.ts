import { describe, expect, it } from 'vitest'
import { applyPatch, createDefaultParams } from '../params/params'
import { parseXmpPreset } from './xmp'

// Structure mirrors a real Lightroom (Android/Camera Raw) preset, with made-up values.
const XMP = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
 <rdf:Description rdf:about="" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   crs:Version="15.1" crs:WhiteBalance="Custom"
   crs:IncrementalTemperature="0" crs:IncrementalTint="-6"
   crs:Exposure2012="+0.35" crs:Contrast2012="+35" crs:Highlights2012="-45" crs:Vibrance="+35" crs:Saturation="-16"
   crs:ParametricLights="+12" crs:ParametricShadowSplit="25"
   crs:HueAdjustmentOrange="-14" crs:SaturationAdjustmentGreen="-100" crs:LuminanceAdjustmentOrange="+26"
   crs:SplitToningShadowHue="220" crs:SplitToningShadowSaturation="40"
   crs:SplitToningHighlightHue="55" crs:SplitToningHighlightSaturation="20"
   crs:ColorGradeMidtoneHue="56" crs:ColorGradeMidtoneSat="20" crs:ColorGradeBlending="50"
   crs:Sharpness="30" crs:LuminanceSmoothing="20" crs:ColorNoiseReduction="20"
   crs:DefringePurpleAmount="0" crs:DefringeGreenAmount="5"
   crs:PostCropVignetteAmount="-10" crs:GrainAmount="0"
   crs:ConvertToGrayscale="False" crs:Temperature="5500" crs:CameraProfile="Embedded" crs:LensProfileEnable="0">
   <crs:ToneCurvePV2012><rdf:Seq><rdf:li>14, 0</rdf:li><rdf:li>133, 127</rdf:li><rdf:li>255, 238</rdf:li></rdf:Seq></crs:ToneCurvePV2012>
   <crs:ToneCurvePV2012Blue><rdf:Seq><rdf:li>0, 0</rdf:li><rdf:li>146, 112</rdf:li><rdf:li>255, 255</rdf:li></rdf:Seq></crs:ToneCurvePV2012Blue>
   <crs:Name><rdf:Alt><rdf:li xml:lang="x-default">Blue &amp; Teal</rdf:li></rdf:Alt></crs:Name>
   <crs:Group><rdf:Alt><rdf:li xml:lang="x-default">My Presets</rdf:li></rdf:Alt></crs:Group>
 </rdf:Description></rdf:RDF></x:xmpmeta>`

describe('parseXmpPreset', () => {
  const r = parseXmpPreset(XMP)
  const out = applyPatch(createDefaultParams(), r.patch)

  it('reads name and group', () => {
    expect(r.name).toBe('Blue & Teal')
    expect(r.group).toBe('My Presets')
  })
  it('maps basic values incl. signed strings and relative white balance', () => {
    expect(out.basic).toMatchObject({ exposure: 0.35, contrast: 35, highlights: -45, vibrance: 35, saturation: -16, temp: 0, tint: -6 })
  })
  it('maps tone curves (0..255 → 0..1), keeping a first point that is not at x=0', () => {
    expect(out.toneCurve.points.rgb[0]!.x).toBeCloseTo(14 / 255, 6)
    expect(out.toneCurve.points.rgb).toHaveLength(3)
    expect(out.toneCurve.points.b[1]!.y).toBeCloseTo(112 / 255, 6)
    expect(out.toneCurve.points.r).toHaveLength(2) // untouched default
    expect(out.toneCurve.parametric.lights).toBe(12)
  })
  it('maps mixer, and colour grading from SplitToning + ColorGrade keys', () => {
    expect(out.mixer.hue.orange).toBe(-14)
    expect(out.mixer.sat.green).toBe(-100)
    expect(out.mixer.lum.orange).toBe(26)
    expect(out.grading.shadows).toMatchObject({ h: 220, s: 40 })
    expect(out.grading.highlights).toMatchObject({ h: 55, s: 20 })
    expect(out.grading.midtones).toMatchObject({ h: 56, s: 20 })
  })
  it('maps detail, lens, effects', () => {
    expect(out.detail).toMatchObject({ sharpAmount: 30, nrLum: 20, nrColor: 20 })
    expect(out.lens.defringe).toBe(5)
    expect(out.effects.vigAmount).toBe(-10)
  })
  it('is sparse: keys not in the file stay at defaults', () => {
    expect(out.basic.dehaze).toBe(0)
    expect(r.patch.transform).toBeUndefined()
  })
  it('reports settings it cannot represent', () => {
    expect(r.skipped).toContain('Temperature (absolute)')
    expect(r.skipped).toContain('CameraProfile')
    expect(r.skipped).not.toContain('LensProfileEnable')
  })
  it('handles grayscale and child-element scalars', () => {
    const g = parseXmpPreset('<crs:ConvertToGrayscale>True</crs:ConvertToGrayscale><crs:Exposure2012>-1.5</crs:Exposure2012>')
    const o = applyPatch(createDefaultParams(), g.patch)
    expect(o.bw.enabled).toBe(true)
    expect(o.basic.exposure).toBe(-1.5)
  })
  it('clamps out-of-range values and tolerates garbage', () => {
    const o = applyPatch(createDefaultParams(), parseXmpPreset('crs:Contrast2012="+900" crs:Vibrance="abc"').patch)
    expect(o.basic.contrast).toBe(100)
    expect(o.basic.vibrance).toBe(0)
    expect(parseXmpPreset('not xml').applied).toBe(0)
  })
})
