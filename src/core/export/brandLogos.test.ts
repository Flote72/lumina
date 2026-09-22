import { describe, expect, it } from 'vitest'
import { BRAND_KEYS, BRAND_LABELS, resolveBrandKey } from './brandLogos'

describe('resolveBrandKey', () => {
  it('matches real-world EXIF Make/Model strings', () => {
    expect(resolveBrandKey('Canon EOS 5D Mark II')).toBe('canon')
    expect(resolveBrandKey('NIKON CORPORATION NIKON Z6')).toBe('nikon')
    expect(resolveBrandKey('SONY ILCE-7M4')).toBe('sony')
    expect(resolveBrandKey('FUJIFILM X-T5')).toBe('fujifilm')
    expect(resolveBrandKey('OLYMPUS IMAGING CORP. E-M1')).toBe('olympus')
    expect(resolveBrandKey('Panasonic DC-S5')).toBe('panasonic')
    expect(resolveBrandKey('LEICA CAMERA AG M11')).toBe('leica')
    expect(resolveBrandKey('Apple iPhone 15 Pro')).toBe('apple')
    expect(resolveBrandKey('Google Pixel 8')).toBe('google')
  })
  it('is case-insensitive and tolerates surrounding text', () => {
    expect(resolveBrandKey('canon')).toBe('canon')
    expect(resolveBrandKey('  Sony  ILCE-7M4 ')).toBe('sony')
  })
  it('disambiguates the Pentax/Ricoh overlap toward Pentax', () => {
    expect(resolveBrandKey('RICOH IMAGING COMPANY, LTD. PENTAX K-3 Mark III')).toBe('pentax')
    expect(resolveBrandKey('RICOH GR III')).toBe('ricoh')
  })
  it('returns null for unknown or empty input', () => {
    expect(resolveBrandKey('Some Random Brand X100')).toBeNull()
    expect(resolveBrandKey('')).toBeNull()
    expect(resolveBrandKey(undefined)).toBeNull()
    expect(resolveBrandKey(null)).toBeNull()
  })
})

describe('BRAND_LABELS', () => {
  it('has a display label for every brand key, and only known keys', () => {
    for (const key of BRAND_KEYS) expect(BRAND_LABELS[key]).toBeTruthy()
    expect(Object.keys(BRAND_LABELS).sort()).toEqual([...BRAND_KEYS].sort())
  })
})
