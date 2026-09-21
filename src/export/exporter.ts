import type { EditParams } from '@/core/params/params'
import {
  outputSharpenAmount,
  outputSize,
  tiles,
  watermarkOrigin,
  type ResizeSettings,
  type SharpenAmount,
  type SharpenTarget,
  type WatermarkPosition,
} from '@/core/export/size'
import { buildXmpSegment, extractExifSegment, injectJpegSegments, pngWithText, resetExifOrientation } from '@/core/export/fileMeta'
import { Renderer } from '@/render/Renderer'

export type ExportFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export interface WatermarkSettings {
  enabled: boolean
  kind: 'text' | 'image'
  text: string
  position: WatermarkPosition
  /** % of output width */
  sizePct: number
  /** 0..100 */
  opacity: number
  /** % of the short side */
  marginPct: number
}

export interface ExportOptions {
  format: ExportFormat
  /** 0..100 */
  quality: number
  colorSpace: 'srgb' | 'display-p3'
  resize: ResizeSettings
  sharpen: { target: SharpenTarget; amount: SharpenAmount }
  metadata: 'keep' | 'strip'
  copyright: string
  creator: string
  watermark: WatermarkSettings
}

export interface ExportJob {
  file: Blob
  params: EditParams
  options: ExportOptions
  /** watermark image (kind === 'image') */
  watermarkImage?: Blob
}

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  /** true when Display P3 was requested but the browser could not produce it */
  p3Fallback: boolean
}

const MIME: Record<ExportFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }
const TILE = 2048
const MARGIN = 128 // overlap so blurs / sharpening / noise reduction do not show tile seams

let renderer: Renderer | null = null
let glCanvas: OffscreenCanvas | null = null

function getRenderer() {
  if (!renderer) {
    glCanvas = new OffscreenCanvas(16, 16)
    renderer = new Renderer(glCanvas)
  }
  return { r: renderer, canvas: glCanvas! }
}

function p3Supported(): boolean {
  try {
    const c = new OffscreenCanvas(1, 1)
    const g = c.getContext('2d', { colorSpace: 'display-p3' })
    const attrs = (g as unknown as { getContextAttributes?: () => { colorSpace?: string } } | null)?.getContextAttributes?.()
    return attrs?.colorSpace === 'display-p3'
  } catch {
    return false
  }
}

/** Renders one photo at export resolution (tiled) and encodes it. Runs inside the export worker. */
export async function runExport(job: ExportJob, onProgress?: (f: number) => void): Promise<ExportResult> {
  const { options: o } = job
  const { r, canvas } = getRenderer()
  let bmp: ImageBitmap | null = null
  let scaled: ImageBitmap | null = null
  try {
    bmp = await createImageBitmap(job.file, { premultiplyAlpha: 'none', colorSpaceConversion: 'default' })
    const W = bmp.width
    const H = bmp.height
    let upload = bmp
    if (W > r.maxTextureSize || H > r.maxTextureSize) {
      const k = r.maxTextureSize / Math.max(W, H)
      scaled = await createImageBitmap(bmp, { resizeWidth: Math.floor(W * k), resizeHeight: Math.floor(H * k), resizeQuality: 'high' })
      upload = scaled
    }
    r.setSource(upload, W, H)
    bmp.close()
    scaled?.close()
    bmp = scaled = null

    const c = job.params.crop
    const cw = c.w * W
    const ch = c.h * H
    const size = outputSize(cw, ch, o.resize)
    const zoom = size.w / cw // device px per crop px (uniform; aspect is preserved)

    const useP3 = o.colorSpace === 'display-p3' && p3Supported()
    const out = new OffscreenCanvas(size.w, size.h)
    const ctx = out.getContext('2d', { colorSpace: useP3 ? 'display-p3' : 'srgb' })!

    // output sharpening is added on top of the photo's own sharpening
    const params = structuredClone(job.params)
    const extra = outputSharpenAmount(o.sharpen.target, o.sharpen.amount)
    if (extra > 0) {
      if (params.detail.sharpAmount === 0) {
        params.detail.sharpRadius = 0.7 / zoom
        params.detail.sharpDetail = 25
      }
      params.detail.sharpAmount = Math.min(150, params.detail.sharpAmount + extra)
    }

    const T = Math.min(TILE, r.maxTextureSize - 2 * MARGIN)
    const list = tiles(size.w, size.h, T)
    for (let i = 0; i < list.length; i++) {
      const t = list[i]!
      const cwT = t.w + 2 * MARGIN
      const chT = t.h + 2 * MARGIN
      r.resize(cwT, chT, false)
      // viewport pixel v ↔ output pixel q = v + (t - MARGIN); crop centre maps to the centre of the whole output
      const pan: [number, number] = [size.w / 2 - cwT / 2 - (t.x - MARGIN), size.h / 2 - chT / 2 - (t.y - MARGIN)]
      r.render({ params, before: params, zoom, pan, cropEdit: false, compare: { mode: 'off', pos: 0.5 }, clipping: false, bleed: 1.5 })
      ctx.drawImage(canvas, MARGIN, MARGIN, t.w, t.h, t.x, t.y, t.w, t.h)
      onProgress?.((i + 1) / list.length)
      // let the worker breathe between tiles (keeps cancel / progress messages flowing)
      await new Promise((res) => setTimeout(res, 0))
    }

    if (o.watermark.enabled) await drawWatermark(ctx, size.w, size.h, o.watermark, job.watermarkImage)

    let blob = await out.convertToBlob({ type: MIME[o.format], quality: o.quality / 100 })
    if (blob.type !== MIME[o.format]) throw new Error(`This browser cannot encode ${o.format.toUpperCase()}`)
    blob = await withMetadata(blob, job.file, o)
    return { blob, width: size.w, height: size.h, p3Fallback: o.colorSpace === 'display-p3' && !useP3 }
  } finally {
    bmp?.close()
    scaled?.close()
    r.clearSource() // free the source texture between photos
  }
}

async function drawWatermark(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, wm: WatermarkSettings, image?: Blob) {
  const margin = Math.round((Math.min(w, h) * wm.marginPct) / 100)
  ctx.save()
  ctx.globalAlpha = Math.min(1, Math.max(0, wm.opacity / 100))
  if (wm.kind === 'image') {
    if (!image) {
      ctx.restore()
      return
    }
    const bmp = await createImageBitmap(image)
    const ww = Math.max(1, Math.round((w * wm.sizePct) / 100))
    const wh = Math.max(1, Math.round((ww * bmp.height) / bmp.width))
    const { x, y } = watermarkOrigin(wm.position, w, h, ww, wh, margin)
    ctx.drawImage(bmp, x, y, ww, wh)
    bmp.close()
  } else if (wm.text.trim()) {
    // choose a font size so the text is about sizePct of the output width
    const probe = 100
    ctx.font = `600 ${probe}px sans-serif`
    const base = ctx.measureText(wm.text).width || 1
    const fontPx = Math.max(8, Math.round((probe * ((w * wm.sizePct) / 100)) / base))
    ctx.font = `600 ${fontPx}px sans-serif`
    ctx.textBaseline = 'top'
    const tw = ctx.measureText(wm.text).width
    const { x, y } = watermarkOrigin(wm.position, w, h, tw, fontPx, margin)
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = fontPx * 0.12
    ctx.fillStyle = '#ffffff'
    ctx.fillText(wm.text, x, y)
  }
  ctx.restore()
}

/** JPEG: copy original EXIF (optional) + XMP copyright. PNG: tEXt copyright. Other formats: unchanged. */
async function withMetadata(blob: Blob, original: Blob, o: ExportOptions): Promise<Blob> {
  const wantsCopyright = o.copyright.trim() || o.creator.trim()
  const wantsExif = o.metadata === 'keep'
  if (o.format === 'jpeg' && (wantsCopyright || wantsExif)) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const segs: Uint8Array[] = []
    if (wantsExif) {
      const head = new Uint8Array(await original.slice(0, 1 << 20).arrayBuffer())
      const exif = extractExifSegment(head)
      if (exif) segs.push(resetExifOrientation(exif))
    }
    if (wantsCopyright) segs.push(buildXmpSegment({ rights: o.copyright.trim() || undefined, creator: o.creator.trim() || undefined }))
    return new Blob([injectJpegSegments(bytes, segs) as BlobPart], { type: 'image/jpeg' })
  }
  if (o.format === 'png' && wantsCopyright) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const entries: Record<string, string> = {}
    if (o.copyright.trim()) entries.Copyright = o.copyright.trim()
    if (o.creator.trim()) entries.Author = o.creator.trim()
    return new Blob([pngWithText(bytes, entries) as BlobPart], { type: 'image/png' })
  }
  return blob
}
