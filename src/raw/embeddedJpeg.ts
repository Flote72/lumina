/**
 * Fallback for RAW files LibRaw cannot decode: most RAW containers (CR2, NEF, ARW, ORF, RW2, DNG…) embed one or
 * more JPEG previews. We locate every JPEG stream by walking its markers, and return them largest first.
 */

/** Index one past the last byte of the JPEG that starts at `start` (SOI), or -1 if it is malformed. */
export function jpegEnd(b: Uint8Array, start: number): number {
  if (b[start] !== 0xff || b[start + 1] !== 0xd8) return -1
  let i = start + 2
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) return -1
    const m = b[i + 1]!
    if (m === 0xff) {
      i++ // fill byte
      continue
    }
    if (m === 0xd9) return i + 2
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      i += 2
      continue
    }
    if (i + 3 >= b.length) return -1
    const len = (b[i + 2]! << 8) | b[i + 3]!
    if (len < 2) return -1
    i += 2 + len
    if (m === 0xda) {
      // entropy-coded data: runs until the next marker that is not stuffing (FF00) or a restart (FFD0–D7)
      while (i + 1 < b.length) {
        if (b[i] === 0xff) {
          const n = b[i + 1]!
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) {
            i += 2
            continue
          }
          break
        }
        i++
      }
    }
  }
  return -1
}

export interface EmbeddedJpeg {
  start: number
  end: number
  size: number
}

/** All complete JPEG streams inside `bytes`, largest first. Streams nested inside a larger one are skipped. */
export function findEmbeddedJpegs(bytes: Uint8Array, minSize = 20_000): EmbeddedJpeg[] {
  const found: EmbeddedJpeg[] = []
  let i = 0
  while (i + 3 < bytes.length) {
    // SOI followed by another marker
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      const end = jpegEnd(bytes, i)
      if (end > 0) {
        if (end - i >= minSize) found.push({ start: i, end, size: end - i })
        i = end
        continue
      }
    }
    i++
  }
  return found.sort((a, b) => b.size - a.size)
}
