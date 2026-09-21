/**
 * Byte-level metadata helpers for exported files.
 * JPEG: copy the original EXIF (orientation reset), add an XMP packet with copyright/creator.
 * PNG: add tEXt chunks. Pure functions on Uint8Array so they can be unit-tested.
 */

const enc = new TextEncoder()
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function isJpeg(b: Uint8Array) {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8
}

/** The complete APP1 "Exif" segment (marker + length + payload) of a JPEG, or null. */
export function extractExifSegment(jpeg: Uint8Array): Uint8Array | null {
  if (!isJpeg(jpeg)) return null
  let i = 2
  while (i + 4 < jpeg.length) {
    if (jpeg[i] !== 0xff) return null
    const marker = jpeg[i + 1]!
    if (marker === 0xda || marker === 0xd9) return null // image data reached
    const len = (jpeg[i + 2]! << 8) | jpeg[i + 3]!
    if (marker === 0xe1 && len >= 8 && jpeg[i + 4] === 0x45 && jpeg[i + 5] === 0x78 && jpeg[i + 6] === 0x69 && jpeg[i + 7] === 0x66) {
      return jpeg.slice(i, i + 2 + len)
    }
    i += 2 + len
  }
  return null
}

/** Copy of an EXIF APP1 segment with Orientation set to 1 (pixels were already rotated on export). */
export function resetExifOrientation(seg: Uint8Array): Uint8Array {
  const out = seg.slice()
  const tiff = 10 // FFE1 + len(2) + "Exif\0\0"
  if (out.length < tiff + 8) return out
  const le = out[tiff] === 0x49
  const u16 = (o: number) => (le ? out[o]! | (out[o + 1]! << 8) : (out[o]! << 8) | out[o + 1]!)
  const u32 = (o: number) => (le ? (out[o]! | (out[o + 1]! << 8) | (out[o + 2]! << 16) | (out[o + 3]! << 24)) >>> 0 : ((out[o]! << 24) | (out[o + 1]! << 16) | (out[o + 2]! << 8) | out[o + 3]!) >>> 0)
  const ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > out.length) return out
  const n = u16(ifd)
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12
    if (e + 12 > out.length) break
    if (u16(e) === 0x0112) {
      if (le) {
        out[e + 8] = 1
        out[e + 9] = 0
      } else {
        out[e + 8] = 0
        out[e + 9] = 1
      }
      break
    }
  }
  return out
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** APP1 XMP segment carrying dc:rights / dc:creator. */
export function buildXmpSegment(meta: { rights?: string; creator?: string }): Uint8Array {
  const alt = (tag: string, v: string) => `<dc:${tag}><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(v)}</rdf:li></rdf:Alt></dc:${tag}>`
  const seq = (tag: string, v: string) => `<dc:${tag}><rdf:Seq><rdf:li>${xmlEscape(v)}</rdf:li></rdf:Seq></dc:${tag}>`
  const xml =
    `<?xpacket begin="${String.fromCharCode(0xfeff)}" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Lumina">` +
    `${meta.rights ? alt('rights', meta.rights) : ''}${meta.creator ? seq('creator', meta.creator) : ''}` +
    `</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
  const ns = enc.encode('http://ns.adobe.com/xap/1.0/\0')
  const body = enc.encode(xml)
  const len = 2 + ns.length + body.length
  if (len > 0xffff) throw new Error('XMP too large')
  return cat(new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff]), ns, body)
}

/** Insert segments right after SOI (and after a leading JFIF APP0 if present). */
export function injectJpegSegments(jpeg: Uint8Array, segments: Uint8Array[]): Uint8Array {
  if (!isJpeg(jpeg) || !segments.length) return jpeg
  // a JFIF APP0 segment (FF E0, 2-byte length that includes itself) stays first
  const at = jpeg[2] === 0xff && jpeg[3] === 0xe0 ? 4 + ((jpeg[4]! << 8) | jpeg[5]!) : 2
  return cat(jpeg.slice(0, at), ...segments, jpeg.slice(at))
}

let crcTable: Uint32Array | null = null
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** PNG with tEXt chunks (Latin-1 keyword, UTF-8-safe text stored as iTXt-less plain bytes). */
export function pngWithText(png: Uint8Array, entries: Record<string, string>): Uint8Array {
  const sig = 8
  if (png.length < 33 || png[1] !== 0x50) return png
  const ihdrEnd = sig + 8 + 13 + 4 // length+type + data + crc
  const chunks: Uint8Array[] = []
  for (const [key, value] of Object.entries(entries)) {
    const data = cat(enc.encode(key), new Uint8Array([0]), enc.encode(value))
    const type = enc.encode('tEXt')
    const chunk = new Uint8Array(12 + data.length)
    const dv = new DataView(chunk.buffer)
    dv.setUint32(0, data.length)
    chunk.set(type, 4)
    chunk.set(data, 8)
    dv.setUint32(8 + data.length, crc32(cat(type, data)))
    chunks.push(chunk)
  }
  return cat(png.slice(0, ihdrEnd), ...chunks, png.slice(ihdrEnd))
}
