import { describe, expect, it } from 'vitest'
import {
  buildFrameLines,
  buildStrapParts,
  computeFrameGeometry,
  DEFAULT_FRAME,
  formatAperture,
  formatDate,
  formatDateTime,
  formatFocalLength,
  formatFStop,
  formatIso,
  formatShutter,
  frameHasContent,
  joinMakeModel,
  strapHasContent,
  type FrameSettings,
} from './frame'

const EXIF = { make: 'Sony', model: 'Sony ILCE-7M4', lens: 'FE 24-70mm F2.8 GM', focalLength: 35, fNumber: 2.8, exposureTime: 1 / 500, iso: 100, capturedAt: Date.UTC(2026, 4, 3, 13, 47, 44) }

describe('formatting helpers', () => {
  it('de-duplicates the maker prefix in the model name', () => {
    expect(joinMakeModel('Sony', 'Sony ILCE-7M4')).toBe('Sony ILCE-7M4')
    expect(joinMakeModel('Canon', 'EOS R5')).toBe('Canon EOS R5')
    expect(joinMakeModel('', 'EOS R5')).toBe('EOS R5')
    expect(joinMakeModel('Canon', '')).toBe('Canon')
  })
  it('formats shutter speed as a fraction or seconds, both always ending in "s"', () => {
    expect(formatShutter(1 / 800)).toBe('1/800s')
    expect(formatShutter(1 / 500)).toBe('1/500s')
    expect(formatShutter(2)).toBe('2s')
    expect(formatShutter(2.5)).toBe('2.5s')
    expect(formatShutter(null)).toBe('')
    expect(formatShutter(0)).toBe('')
  })
  it('formats aperture two ways: "f/2.8" for the generic line, "F8" for Strap', () => {
    expect(formatAperture(2.8)).toBe('f/2.8')
    expect(formatAperture(4)).toBe('f/4')
    expect(formatAperture(null)).toBe('')
    expect(formatFStop(8)).toBe('F8')
    expect(formatFStop(1.4)).toBe('F1.4')
    expect(formatFStop(null)).toBe('')
  })
  it('formats focal length and iso; empty for missing values', () => {
    expect(formatFocalLength(35.4)).toBe('35mm')
    expect(formatFocalLength(undefined)).toBe('')
    expect(formatIso(100)).toBe('ISO100')
    expect(formatIso(0)).toBe('')
  })
  it('formats a date, and a Strap-style full date+time', () => {
    expect(formatDate(Date.UTC(2026, 4, 3))).toMatch(/^2026\.05\.0[23]$/) // timezone-tolerant
    expect(formatDate(null)).toBe('')
    expect(formatDateTime(EXIF.capturedAt)).toMatch(/^2026\/05\/0[23] \d{2}:\d{2}:\d{2}$/)
    expect(formatDateTime(null)).toBe('')
  })
})

describe('buildFrameLines', () => {
  it('composes both lines from the enabled toggles (showDate defaults on)', () => {
    const lines = buildFrameLines(EXIF, DEFAULT_FRAME)
    expect(lines.primary).toBe('Sony ILCE-7M4  FE 24-70mm F2.8 GM')
    expect(lines.secondary).toContain('35mm')
    expect(lines.secondary).toContain('f/2.8')
    expect(lines.secondary).toContain('1/500s')
    expect(lines.secondary).toContain('ISO100')
    expect(lines.secondary).toContain('2026')
  })
  it('a manual lens override replaces the EXIF lens name, everywhere lens is shown', () => {
    const s: FrameSettings = { ...DEFAULT_FRAME, lensOverride: 'SIGMA 85mm f1.4 EX DG HSM' }
    expect(buildFrameLines(EXIF, s).primary).toBe('Sony ILCE-7M4  SIGMA 85mm f1.4 EX DG HSM')
    expect(buildFrameLines({ ...EXIF, lens: '' }, s).primary).toBe('Sony ILCE-7M4  SIGMA 85mm f1.4 EX DG HSM')
  })
  it('omits missing / disabled fields without leaving stray separators', () => {
    const s: FrameSettings = { ...DEFAULT_FRAME, showLens: false, showFocalLength: false, showDate: true, customText: 'Seoul' }
    const lines = buildFrameLines({ ...EXIF, lens: '' }, s)
    expect(lines.primary).toBe('Sony ILCE-7M4')
    expect(lines.secondary.split('   ·   ')).toEqual(['f/2.8', '1/500s', 'ISO100', expect.stringMatching(/^2026\./), 'Seoul'])
  })
  it('produces empty lines when everything is off, and frameHasContent reflects that', () => {
    const s: FrameSettings = { ...DEFAULT_FRAME, showCamera: false, showLens: false, showExposure: false, showFocalLength: false, showDate: false, customText: '' }
    const lines = buildFrameLines(EXIF, s)
    expect(lines).toEqual({ primary: '', secondary: '' })
    expect(frameHasContent(lines)).toBe(false)
    expect(frameHasContent(buildFrameLines(EXIF, DEFAULT_FRAME))).toBe(true)
  })
})

describe('buildStrapParts (the fixed Strap layout)', () => {
  it('matches the reference composition: "ISO# F# shutter" and full date/time on the left, camera/lens on the right', () => {
    const p = buildStrapParts(EXIF, DEFAULT_FRAME)
    expect(p.exposure).toBe('ISO100 F2.8 1/500s')
    expect(p.date).toMatch(/^2026\/05\/0[23] \d{2}:\d{2}:\d{2}$/)
    expect(p.camera).toBe('Sony ILCE-7M4')
    expect(p.lens).toBe('FE 24-70mm F2.8 GM')
    expect(strapHasContent(p)).toBe(true)
  })
  it('a lens override is used instead of the EXIF lens', () => {
    const s: FrameSettings = { ...DEFAULT_FRAME, lensOverride: 'SIGMA 85mm f1.4 EX DG HSM' }
    expect(buildStrapParts(EXIF, s).lens).toBe('SIGMA 85mm f1.4 EX DG HSM')
  })
  it('each toggle independently clears its own part, never the others', () => {
    const base = buildStrapParts(EXIF, DEFAULT_FRAME)
    expect(buildStrapParts(EXIF, { ...DEFAULT_FRAME, showExposure: false }).exposure).toBe('')
    expect(buildStrapParts(EXIF, { ...DEFAULT_FRAME, showDate: false }).date).toBe('')
    expect(buildStrapParts(EXIF, { ...DEFAULT_FRAME, showCamera: false })).toMatchObject({ exposure: base.exposure, date: base.date, camera: '', lens: base.lens })
    expect(buildStrapParts(EXIF, { ...DEFAULT_FRAME, showLens: false }).lens).toBe('')
  })
  it('is empty (and strapHasContent false) only when every part is off', () => {
    const s: FrameSettings = { ...DEFAULT_FRAME, showCamera: false, showLens: false, showExposure: false, showDate: false }
    expect(strapHasContent(buildStrapParts(EXIF, s))).toBe(false)
    expect(strapHasContent(buildStrapParts(EXIF, { ...s, showCamera: true }))).toBe(true)
  })
})

describe('computeFrameGeometry', () => {
  const lines = buildFrameLines(EXIF, DEFAULT_FRAME) // two non-empty lines

  it('extends the canvas downward for position=bottom, keeping the photo at the origin', () => {
    const g = computeFrameGeometry(3000, 2000, 'strap', 'bottom', lines)
    expect(g.photoX).toBe(0)
    expect(g.photoY).toBe(0)
    expect(g.outW).toBe(3000)
    expect(g.outH).toBe(2000 + g.barH)
    expect(g.barY).toBe(2000)
    expect(g.barH).toBeGreaterThan(0)
  })
  it('extends upward for position=top, pushing the photo down by the bar height', () => {
    const g = computeFrameGeometry(3000, 2000, 'strap', 'top', lines)
    expect(g.barY).toBe(0)
    expect(g.photoY).toBe(g.barH)
    expect(g.outH).toBe(2000 + g.barH)
  })
  it('film style adds a margin around the photo on every side', () => {
    const g = computeFrameGeometry(3000, 2000, 'film', 'bottom', lines)
    expect(g.photoX).toBeGreaterThan(0)
    expect(g.photoY).toBeGreaterThan(0)
    expect(g.outW).toBe(3000 + g.photoX * 2)
    expect(g.barW).toBe(g.outW)
  })
  it('collapses to a single centred line when only one line has content', () => {
    const oneSided = { primary: 'Sony ILCE-7M4', secondary: '' }
    const g = computeFrameGeometry(3000, 2000, 'strap', 'bottom', oneSided)
    expect(g.oneLine).toBe(true)
    expect(g.divider).toBe(false)
    const two = computeFrameGeometry(3000, 2000, 'strap', 'bottom', lines)
    expect(g.barH).toBeLessThan(two.barH) // a one-line bar is shorter
  })
  it('minimal style is always one line and has no divider', () => {
    const g = computeFrameGeometry(3000, 2000, 'minimal', 'bottom', lines)
    expect(g.oneLine).toBe(true)
    expect(g.divider).toBe(false)
    expect(g.align).toBe('left')
  })
  it('scales with resolution: a 6000px-wide photo gets a taller bar than a 1500px one, same aspect', () => {
    const small = computeFrameGeometry(1500, 1000, 'strap', 'bottom', lines)
    const big = computeFrameGeometry(6000, 4000, 'strap', 'bottom', lines)
    expect(big.barH).toBeCloseTo(small.barH * 4, -1)
    expect(big.primaryPx).toBeGreaterThan(small.primaryPx)
  })
  it('font sizes stay positive even for tiny images', () => {
    const g = computeFrameGeometry(80, 60, 'minimal', 'bottom', lines)
    expect(g.primaryPx).toBeGreaterThan(0)
    expect(g.barH).toBeGreaterThan(0)
  })
})
