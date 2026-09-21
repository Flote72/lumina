import { describe, expect, it } from 'vitest'
import { findEmbeddedJpegs, jpegEnd } from './embeddedJpeg'

/** Minimal structurally valid JPEG: SOI, APP0, SOS with `n` bytes of entropy data (incl. FF00 stuffing), EOI. */
function jpeg(n: number): number[] {
  const entropy: number[] = []
  for (let i = 0; i < n; i++) entropy.push(i % 50 === 0 ? 0xff : i % 251, ...(i % 50 === 0 ? [0x00] : []))
  return [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x04, 0x00, 0x00, ...entropy, 0xff, 0xd9]
}

describe('embedded JPEG search', () => {
  it('finds the end of a JPEG, ignoring byte stuffing', () => {
    const j = new Uint8Array(jpeg(500))
    expect(jpegEnd(j, 0)).toBe(j.length)
  })
  it('rejects malformed streams', () => {
    expect(jpegEnd(new Uint8Array([1, 2, 3, 4]), 0)).toBe(-1)
    expect(jpegEnd(new Uint8Array([0xff, 0xd8, 0x12, 0x34, 0x00]), 0)).toBe(-1)
  })
  it('locates several previews inside a RAW-like blob, largest first', () => {
    const small = jpeg(30_000)
    const big = jpeg(120_000)
    const raw = new Uint8Array([...Array(1000).fill(7), ...small, ...Array(500).fill(9), ...big, ...Array(300).fill(1)])
    const r = findEmbeddedJpegs(raw)
    expect(r).toHaveLength(2)
    expect(r[0]!.size).toBe(big.length)
    expect(r[1]!.size).toBe(small.length)
    expect(Array.from(raw.slice(r[0]!.start, r[0]!.start + 2))).toEqual([0xff, 0xd8])
  })
  it('skips tiny thumbnails', () => {
    expect(findEmbeddedJpegs(new Uint8Array(jpeg(200)))).toHaveLength(0)
  })
})
