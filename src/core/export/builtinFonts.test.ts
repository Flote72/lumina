import { describe, expect, it } from 'vitest'
import { BUILTIN_FRAME_FONTS, builtinFontUrl } from './builtinFonts'

describe('builtin frame fonts', () => {
  it('lists at least one font with a name, key and file path', () => {
    expect(BUILTIN_FRAME_FONTS.length).toBeGreaterThan(0)
    for (const f of BUILTIN_FRAME_FONTS) {
      expect(f.key).toBeTruthy()
      expect(f.name).toBeTruthy()
      expect(f.file).toMatch(/^fonts\//)
    }
  })
  it('builds a URL under BASE_URL', () => {
    expect(builtinFontUrl('fonts/x/y.ttf')).toBe(`${import.meta.env.BASE_URL}fonts/x/y.ttf`)
  })
})
