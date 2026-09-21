import { MIXER_COLORS, type CurvePoint, type DeepPartial, type EditParams } from '../params/params'

export interface XmpPreset {
  name: string
  group: string
  patch: DeepPartial<EditParams>
  /** number of settings that were translated */
  applied: number
  /** settings present in the file that Lumina cannot represent */
  skipped: string[]
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const num = (v: string | undefined): number | null => {
  if (v === undefined) return null
  const n = Number(v.trim().replace(/^\+/, ''))
  return Number.isFinite(n) ? n : null
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Collect `crs:` scalars (attributes or simple child elements), curve sequences and localized text. */
function readCrs(xml: string) {
  const scalars = new Map<string, string>()
  const attr = /\bcrs:([A-Za-z0-9]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  for (let m; (m = attr.exec(xml)); ) scalars.set(m[1]!, decode(m[3] ?? m[4] ?? ''))
  const elem = /<crs:([A-Za-z0-9]+)>\s*([^<\s][^<]*?)\s*<\/crs:\1>/g
  for (let m; (m = elem.exec(xml)); ) if (!scalars.has(m[1]!)) scalars.set(m[1]!, decode(m[2]!))

  const seqs = new Map<string, string[]>()
  const seq = /<crs:([A-Za-z0-9]+)>\s*<rdf:Seq>([\s\S]*?)<\/rdf:Seq>\s*<\/crs:\1>/g
  for (let m; (m = seq.exec(xml)); ) {
    const items = [...m[2]!.matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/g)].map((x) => decode(x[1]!.trim()))
    seqs.set(m[1]!, items)
  }
  const text = (key: string) => {
    const m = new RegExp(`<crs:${key}>\\s*<rdf:Alt>[\\s\\S]*?<rdf:li[^>]*>([\\s\\S]*?)</rdf:li>`).exec(xml)
    return m ? decode(m[1]!.trim()) : (scalars.get(key) ?? '')
  }
  return { scalars, seqs, text }
}

function parseCurve(items: string[] | undefined): CurvePoint[] | null {
  if (!items) return null
  const pts = items
    .map((s) => s.split(',').map((v) => Number(v.trim())))
    .filter((a) => a.length === 2 && a.every(Number.isFinite))
    .map(([x, y]) => ({ x: clamp(x! / 255, 0, 1), y: clamp(y! / 255, 0, 1) }))
  return pts.length >= 2 ? pts : null
}

/** crs keys that carry no visual setting (or are handled/unsupported without needing a report). */
const IGNORED = new Set([
  'Version', 'ProcessVersion', 'WhiteBalance', 'HasSettings', 'AlreadyApplied', 'ToneCurveName2012', 'ToneCurveName',
  'CameraProfileDigest', 'ConvertToGrayscale', 'OverrideLookVignette', 'HasCrop', 'LensProfileEnable', 'AutoLateralCA',
  'Name', 'Group', 'UUID', 'SupportsAmount', 'SupportsAmount2', 'SupportsColor', 'SupportsMonochrome', 'SupportsHighDynamicRange',
  'SupportsNormalDynamicRange', 'SupportsSceneReferred', 'SupportsOutputReferred', 'ShortName', 'SortName', 'Cluster', 'Description',
  'PostCropVignetteStyle', 'PerspectiveUpright', 'CropConstrainToWarp', 'DefringePurpleHueLo', 'DefringePurpleHueHi',
  'DefringeGreenHueLo', 'DefringeGreenHueHi', 'LuminanceNoiseReductionDetail', 'LuminanceNoiseReductionContrast',
  'ColorNoiseReductionDetail', 'ColorNoiseReductionSmoothness', 'ParametricShadowSplit', 'ParametricMidtoneSplit', 'ParametricHighlightSplit',
])
const TRIVIAL = new Set(['', '0', '0.0', '0.00', '+0', 'False', 'false', 'Custom', 'None'])

/**
 * Translate a Lightroom/Camera Raw `.xmp` preset into a sparse Lumina patch.
 * Only keys present in the file are returned, so applying it leaves everything else untouched.
 */
export function parseXmpPreset(xml: string): XmpPreset {
  const { scalars, seqs, text } = readCrs(xml)
  const patch: Record<string, Record<string, unknown>> = {}
  const used = new Set<string>()
  let applied = 0

  const put = (section: string, path: string[], value: unknown) => {
    let cur: Record<string, unknown> = (patch[section] ??= {})
    for (const k of path.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>
    cur[path[path.length - 1]!] = value
    applied++
  }
  /** numeric scalar → patch, with optional range clamp and scale */
  const map = (keys: string | string[], section: string, path: string[], lo: number, hi: number, scale = 1) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const v = num(scalars.get(key))
      used.add(key)
      if (v !== null) {
        put(section, path, Math.round(clamp(v * scale, lo, hi) * 100) / 100)
        return
      }
    }
  }

  // Basic
  map(['IncrementalTemperature'], 'basic', ['temp'], -100, 100)
  map(['IncrementalTint'], 'basic', ['tint'], -100, 100)
  map(['Exposure2012', 'Exposure'], 'basic', ['exposure'], -5, 5)
  map(['Contrast2012', 'Contrast'], 'basic', ['contrast'], -100, 100)
  map(['Highlights2012'], 'basic', ['highlights'], -100, 100)
  map(['Shadows2012'], 'basic', ['shadows'], -100, 100)
  map(['Whites2012'], 'basic', ['whites'], -100, 100)
  map(['Blacks2012'], 'basic', ['blacks'], -100, 100)
  map('Texture', 'basic', ['texture'], -100, 100)
  map(['Clarity2012', 'Clarity'], 'basic', ['clarity'], -100, 100)
  map('Dehaze', 'basic', ['dehaze'], -100, 100)
  map('Vibrance', 'basic', ['vibrance'], -100, 100)
  map('Saturation', 'basic', ['saturation'], -100, 100)

  // Tone curve
  const pc: [string, string][] = [
    ['ParametricHighlights', 'highlights'], ['ParametricLights', 'lights'], ['ParametricDarks', 'darks'], ['ParametricShadows', 'shadows'],
  ]
  for (const [k, f] of pc) map(k, 'toneCurve', ['parametric', f], -100, 100)
  map('ParametricShadowSplit', 'toneCurve', ['parametric', 'split1'], 5, 90)
  map('ParametricMidtoneSplit', 'toneCurve', ['parametric', 'split2'], 10, 95)
  map('ParametricHighlightSplit', 'toneCurve', ['parametric', 'split3'], 15, 95)
  for (const [key, ch] of [['ToneCurvePV2012', 'rgb'], ['ToneCurvePV2012Red', 'r'], ['ToneCurvePV2012Green', 'g'], ['ToneCurvePV2012Blue', 'b']] as const) {
    used.add(key)
    const pts = parseCurve(seqs.get(key))
    if (pts) put('toneCurve', ['points', ch], pts)
  }

  // Colour mixer
  for (const c of MIXER_COLORS) {
    const C = c[0]!.toUpperCase() + c.slice(1)
    map(`HueAdjustment${C}`, 'mixer', ['hue', c], -100, 100)
    map(`SaturationAdjustment${C}`, 'mixer', ['sat', c], -100, 100)
    map(`LuminanceAdjustment${C}`, 'mixer', ['lum', c], -100, 100)
    map(`GrayMixer${C}`, 'bw', ['mix', c], -100, 100)
  }
  if (/^true$/i.test(scalars.get('ConvertToGrayscale') ?? '')) put('bw', ['enabled'], true)

  // Colour grading: new ColorGrade* keys win over the legacy SplitToning* ones
  const wheel = (region: 'shadows' | 'highlights', cg: string, st: string) => {
    map([`ColorGrade${cg}Hue`, `SplitToning${st}Hue`], 'grading', [region, 'h'], 0, 360)
    map([`ColorGrade${cg}Sat`, `SplitToning${st}Saturation`], 'grading', [region, 's'], 0, 100)
    map(`ColorGrade${cg}Lum`, 'grading', [region, 'l'], -100, 100)
  }
  wheel('shadows', 'Shadow', 'Shadow')
  wheel('highlights', 'Highlight', 'Highlight')
  map('ColorGradeMidtoneHue', 'grading', ['midtones', 'h'], 0, 360)
  map('ColorGradeMidtoneSat', 'grading', ['midtones', 's'], 0, 100)
  map('ColorGradeMidtoneLum', 'grading', ['midtones', 'l'], -100, 100)
  map('ColorGradeGlobalHue', 'grading', ['global', 'h'], 0, 360)
  map('ColorGradeGlobalSat', 'grading', ['global', 's'], 0, 100)
  map('ColorGradeGlobalLum', 'grading', ['global', 'l'], -100, 100)
  map('ColorGradeBlending', 'grading', ['blending'], 0, 100)
  map(['ColorGradeBalance', 'SplitToningBalance'], 'grading', ['balance'], -100, 100)

  // Detail
  map('Sharpness', 'detail', ['sharpAmount'], 0, 150)
  map('SharpenRadius', 'detail', ['sharpRadius'], 0.5, 3)
  map('SharpenDetail', 'detail', ['sharpDetail'], 0, 100)
  map('SharpenEdgeMasking', 'detail', ['sharpMasking'], 0, 100)
  map('LuminanceSmoothing', 'detail', ['nrLum'], 0, 100)
  map('ColorNoiseReduction', 'detail', ['nrColor'], 0, 100)

  // Lens
  map('LensManualDistortionAmount', 'lens', ['distortion'], -100, 100)
  map('VignetteAmount', 'lens', ['vignette'], -100, 100)
  map('VignetteMidpoint', 'lens', ['vignetteMid'], 0, 100)
  const fringe = Math.max(num(scalars.get('DefringePurpleAmount')) ?? 0, num(scalars.get('DefringeGreenAmount')) ?? 0)
  used.add('DefringePurpleAmount')
  used.add('DefringeGreenAmount')
  if (scalars.has('DefringePurpleAmount') || scalars.has('DefringeGreenAmount')) put('lens', ['defringe'], clamp(fringe, 0, 100))

  // Transform (Rotate is intentionally not applied: presets should not change the crop angle)
  map('PerspectiveVertical', 'transform', ['vertical'], -100, 100)
  map('PerspectiveHorizontal', 'transform', ['horizontal'], -100, 100)
  map('PerspectiveScale', 'transform', ['scale'], 50, 150)
  map('PerspectiveAspect', 'transform', ['aspect'], -100, 100)
  map('PerspectiveX', 'transform', ['xOffset'], -100, 100)
  map('PerspectiveY', 'transform', ['yOffset'], -100, 100)

  // Effects
  map('PostCropVignetteAmount', 'effects', ['vigAmount'], -100, 100)
  map('PostCropVignetteMidpoint', 'effects', ['vigMid'], 0, 100)
  map('PostCropVignetteRoundness', 'effects', ['vigRound'], -100, 100)
  map('PostCropVignetteFeather', 'effects', ['vigFeather'], 0, 100)
  map('GrainAmount', 'effects', ['grainAmount'], 0, 100)
  map('GrainSize', 'effects', ['grainSize'], 0, 100)
  map('GrainFrequency', 'effects', ['grainRough'], 0, 100)

  // Anything meaningful that we did not translate
  const skipped: string[] = []
  const handled = (k: string) =>
    used.has(k) || IGNORED.has(k) || /^(ColorGrade|SplitToning)/.test(k) || /^(Hue|Saturation|Luminance)Adjustment/.test(k) || /^GrayMixer/.test(k)
  for (const [k, v] of scalars) {
    if (handled(k) || TRIVIAL.has(v.trim())) continue
    if (/^(Temperature|Tint)$/.test(k)) skipped.push(`${k} (absolute)`)
    else skipped.push(k)
  }
  for (const k of seqs.keys()) if (!used.has(k)) skipped.push(k)
  if (/<crs:MaskGroupBasedCorrections/.test(xml)) skipped.push('MaskGroupBasedCorrections')
  if (/<crs:Look>|<crs:Look\b/.test(xml)) skipped.push('Look')

  const name = text('Name').trim()
  return { name: name || 'Imported preset', group: text('Group').trim(), patch: patch as DeepPartial<EditParams>, applied, skipped: [...new Set(skipped)] }
}
