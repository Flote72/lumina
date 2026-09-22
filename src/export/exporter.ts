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
import { buildFrameLines, computeFrameGeometry, frameHasContent, type FrameExifInput, type FrameGeometry, type FrameLines, type FrameSettings } from '@/core/export/frame'
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
  frame: FrameSettings
}

export interface ExportJob {
  file: Blob
  params: EditParams
  options: ExportOptions
  /** watermark image (kind === 'image') */
  watermarkImage?: Blob
  /** EXIF fields for the info frame; omit if unknown (the frame then shows only `customText`, if any) */
  exif?: FrameExifInput
  /** brand logo for the info frame, as a data URL (resolved from EXIF on the main thread — see runBatch.ts) */
  frameLogo?: string
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

    let final: OffscreenCanvas = out
    if (o.frame.enabled) {
      const lines = buildFrameLines(job.exif ?? {}, o.frame)
      if (frameHasContent(lines)) {
        const g = computeFrameGeometry(size.w, size.h, o.frame.style, o.frame.position, lines)
        const logo = o.frame.showLogo && job.frameLogo ? await decodeLogo(job.frameLogo) : null
        final = drawFrame(out, g, lines, o.frame, useP3, logo)
      }
    }

    let blob = await final.convertToBlob({ type: MIME[o.format], quality: o.quality / 100 })
    if (blob.type !== MIME[o.format]) throw new Error(`This browser cannot encode ${o.format.toUpperCase()}`)
    blob = await withMetadata(blob, job.file, o)
    return { blob, width: final.width, height: final.height, p3Fallback: o.colorSpace === 'display-p3' && !useP3 }
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

const FRAME_COLORS = {
  light: { bg: '#f7f6f2', primary: '#141414', secondary: '#5a5a56', divider: 'rgba(0,0,0,0.16)' },
  dark: { bg: '#0c0c0d', primary: '#f2f1ec', secondary: '#9a9a94', divider: 'rgba(255,255,255,0.2)' },
} as const

// Brand logos are never bundled with the app (third-party trademarks, this project is public). If the
// user has uploaded one for the photo's brand (Export → EXIF Frame), it arrives here as a data URL — kept
// only in that browser's localStorage, never written to disk or committed. Cached per data URL so a
// batch export of many photos from the same brand decodes it once.
const logoCache = new Map<string, Promise<ImageBitmap | null>>()
function decodeLogo(dataUrl: string): Promise<ImageBitmap | null> {
  let p = logoCache.get(dataUrl)
  if (!p) {
    p = fetch(dataUrl)
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .catch(() => null)
    logoCache.set(dataUrl, p)
  }
  return p
}

/** Draw the photo onto a larger canvas with a caption bar (+ optional margin) per `g`, and return it. */
function drawFrame(photo: OffscreenCanvas, g: FrameGeometry, lines: FrameLines, frame: FrameSettings, useP3: boolean, logo: ImageBitmap | null): OffscreenCanvas {
  const out = new OffscreenCanvas(g.outW, g.outH)
  const ctx = out.getContext('2d', { colorSpace: useP3 ? 'display-p3' : 'srgb' })!
  const col = FRAME_COLORS[frame.background]

  ctx.fillStyle = col.bg
  ctx.fillRect(0, 0, g.outW, g.outH)
  ctx.drawImage(photo, g.photoX, g.photoY)

  const padX = g.align === 'center' ? 0 : Math.round(g.barH * 0.3)
  let textX = g.align === 'center' ? g.outW / 2 : padX
  const logoPadX = Math.round(g.barH * 0.3)
  if (logo) {
    const logoH = Math.round(g.barH * 0.5)
    const logoW = Math.round(logoH * (logo.width / logo.height))
    ctx.drawImage(logo, logoPadX, g.barY + (g.barH - logoH) / 2, logoW, logoH)
    if (g.align !== 'center') textX = logoPadX + logoW + Math.round(g.barH * 0.28)
  }
  ctx.textAlign = g.align
  ctx.textBaseline = 'middle'
  const maxW = g.align === 'center' ? g.outW - padX * 2 : g.outW - textX - padX

  if (g.oneLine) {
    const text = [lines.primary, lines.secondary].filter(Boolean).join('   ·   ')
    ctx.font = `500 ${g.primaryPx}px system-ui, sans-serif`
    ctx.fillStyle = col.primary
    ctx.fillText(text, textX, g.barY + g.barH / 2, maxW)
  } else {
    const midY = g.barY + g.barH * 0.5
    const lineGap = g.barH * 0.09
    ctx.font = `600 ${g.primaryPx}px system-ui, sans-serif`
    ctx.fillStyle = col.primary
    ctx.fillText(lines.primary, textX, midY - lineGap - g.primaryPx * 0.32, maxW)
    ctx.font = `400 ${g.secondaryPx}px system-ui, sans-serif`
    ctx.fillStyle = col.secondary
    ctx.fillText(lines.secondary, textX, midY + lineGap + g.secondaryPx * 0.32, maxW)
    if (g.divider) {
      ctx.strokeStyle = col.divider
      ctx.lineWidth = Math.max(1, Math.round(g.barH * 0.012))
      ctx.beginPath()
      ctx.moveTo(padX, midY)
      ctx.lineTo(g.outW - padX, midY)
      ctx.stroke()
    }
  }
  return out
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
