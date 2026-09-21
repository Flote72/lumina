import { describe, expect, it } from 'vitest'
import { buildXmpSegment, crc32, extractExifSegment, injectJpegSegments, pngWithText, resetExifOrientation } from './fileMeta'

const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload]

/** Little-endian EXIF APP1 with one IFD0 entry: Orientation = 6. */
function exifWithOrientation(o: number, le = true) {
  const w16 = (v: number) => (le ? [v & 255, v >> 8] : [v >> 8, v & 255])
  const w32 = (v: number) => (le ? [v & 255, (v >> 8) & 255, 0, 0] : [0, 0, (v >> 8) & 255, v & 255])
  const tiff = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(42), ...w32(8), ...w16(1), ...w16(0x0112), ...w16(3), ...w32(1), ...w16(o), 0, 0, ...w32(0)]
  return seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff])
}

const jpeg = (...segments: number[][]) => new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2, 0xff, 0xd9])

describe('JPEG metadata', () => {
  const exif = exifWithOrientation(6)
  const src = jpeg(seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]), exif)

  it('extracts the EXIF segment', () => {
    const e = extractExifSegment(src)!
    expect(Array.from(e)).toEqual(exif)
    expect(extractExifSegment(jpeg(seg(0xe0, [0, 0])))).toBeNull()
    expect(extractExifSegment(new Uint8Array([1, 2, 3]))).toBeNull()
  })
  it('resets orientation to 1 in both byte orders without touching the original', () => {
    for (const le of [true, false]) {
      const s = new Uint8Array(exifWithOrientation(6, le))
      const r = resetExifOrientation(s)
      const at = 10 + 8 + 2 + 8 // tiff start + header + count + tag/type/count
      expect(le ? r[at] : r[at + 1]).toBe(1)
      expect(le ? s[at] : s[at + 1]).toBe(6)
    }
  })
  it('injects after the JFIF header, keeping a valid structure', () => {
    const plain = jpeg(seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]))
    const xmp = buildXmpSegment({ rights: '© Me & Co', creator: 'Me' })
    const out = injectJpegSegments(plain, [new Uint8Array(exif), xmp])
    expect(Array.from(out.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0])
    expect(extractExifSegment(out)).not.toBeNull()
    expect(new TextDecoder().decode(out)).toContain('&amp;')
    expect(new TextDecoder().decode(out)).toContain('dc:rights')
    expect(out.length).toBe(plain.length + exif.length + xmp.length)
    expect(out[out.length - 1]).toBe(0xd9)
  })
  it('injects right after SOI when there is no APP0', () => {
    const out = injectJpegSegments(jpeg(), [new Uint8Array(exif)])
    expect(Array.from(out.slice(2, 4))).toEqual([0xff, 0xe1])
  })
})

describe('PNG text chunks', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('inserts tEXt after IHDR with a valid CRC', () => {
    const ihdr = [0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0, 0, 0, 0]
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
    const out = pngWithText(png, { Copyright: 'Me' })
    expect(out.length).toBe(png.length + 12 + 'Copyright'.length + 1 + 2)
    const at = 8 + 25
    expect(new TextDecoder().decode(out.slice(at + 4, at + 8))).toBe('tEXt')
    const len = new DataView(out.buffer).getUint32(at)
    const crc = new DataView(out.buffer).getUint32(at + 8 + len)
    expect(crc).toBe(crc32(out.slice(at + 4, at + 8 + len)))
  })
})
