import { findEmbeddedJpegs } from './embeddedJpeg'

export type RawMethod = 'libraw' | 'preview'

export interface DevelopedRaw {
  /** image the editing pipeline works from (lossless PNG for LibRaw output, JPEG for a preview) */
  blob: Blob
  width: number
  height: number
  method: RawMethod
}

interface LibRawImage {
  width: number
  height: number
  colors?: number
  bits?: number
  data: Uint8Array | Uint8ClampedArray | Uint16Array
}

/** Pack decoded RGB(A) samples into a canvas and encode losslessly. */
async function toPng(img: LibRawImage): Promise<Blob> {
  const { width: w, height: h } = img
  const px = w * h
  const colors = img.colors ?? Math.round(img.data.length / px)
  const shift = img.data instanceof Uint16Array ? 8 : 0
  const out = new Uint8ClampedArray(px * 4)
  for (let i = 0, o = 0; i < px; i++, o += 4) {
    const s = i * colors
    out[o] = colors >= 3 ? (img.data[s]! >> shift) : (img.data[s]! >> shift)
    out[o + 1] = colors >= 3 ? (img.data[s + 1]! >> shift) : (img.data[s]! >> shift)
    out[o + 2] = colors >= 3 ? (img.data[s + 2]! >> shift) : (img.data[s]! >> shift)
    out[o + 3] = 255
  }
  const c = new OffscreenCanvas(w, h)
  c.getContext('2d')!.putImageData(new ImageData(out, w, h), 0, 0)
  return c.convertToBlob({ type: 'image/png' })
}

/** Decode with LibRaw (camera white balance, sRGB, 8-bit). Throws if the format is unsupported. */
async function viaLibRaw(bytes: Uint8Array): Promise<DevelopedRaw> {
  const { default: LibRaw } = await import('libraw-wasm')
  const raw = new LibRaw()
  await raw.open(bytes as Uint8Array<ArrayBuffer>, { useCameraWb: true, outputColor: 1, outputBps: 8, noAutoBright: false, userQual: 3 })
  const img = (await raw.imageData()) as LibRawImage
  if (!img?.data?.length || !img.width || !img.height) throw new Error('LibRaw returned no image')
  return { blob: await toPng(img), width: img.width, height: img.height, method: 'libraw' }
}

/** Largest embedded JPEG preview that the browser can decode. */
async function viaPreview(bytes: Uint8Array): Promise<DevelopedRaw> {
  for (const j of findEmbeddedJpegs(bytes).slice(0, 4)) {
    const blob = new Blob([bytes.subarray(j.start, j.end) as BlobPart], { type: 'image/jpeg' })
    try {
      const bmp = await createImageBitmap(blob)
      const r = { blob, width: bmp.width, height: bmp.height, method: 'preview' as const }
      bmp.close()
      return r
    } catch {
      /* not decodable, try the next */
    }
  }
  throw new Error('No usable preview found in this RAW file')
}

/**
 * "Develop" a RAW file into something the WebGL pipeline can edit.
 * 1) LibRaw (WASM) full decode; 2) if that fails, the embedded JPEG preview.
 */
export async function developRaw(file: File, onMethod?: (m: RawMethod) => void): Promise<DevelopedRaw> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const r = await viaLibRaw(bytes)
    onMethod?.('libraw')
    return r
  } catch (libErr) {
    try {
      const r = await viaPreview(bytes)
      onMethod?.('preview')
      return r
    } catch {
      throw libErr instanceof Error ? libErr : new Error(String(libErr))
    }
  }
}
