import { buildCurveLUT, isIdentityCurve } from '@/core/curve/curve'
import { gradingActive, wheelOffset } from '@/core/color/grading'
import { MIXER_COLORS, passNeeds, type EditParams } from '@/core/params/params'
import { wbGains } from '@/core/color/whiteBalance'
import { frameSize } from '@/core/geometry/crop'
import blitSrc from './shaders/blit.frag.glsl?raw'
import blurSrc from './shaders/blur.frag.glsl?raw'
import cleanupSrc from './shaders/cleanup.frag.glsl?raw'
import finalSrc from './shaders/final.frag.glsl?raw'
import geometrySrc from './shaders/geometry.frag.glsl?raw'
import { Program, Target, type AnyCanvas, type TargetFormat } from './gl'
import type { RenderState } from './protocol'

const HIST_W = 256
const HIST_H = 160
// Blur radii in output-image pixels (scaled by zoom so the look is resolution independent)
const TEXTURE_SIGMA = 2.0
const CLARITY_SIGMA = 24

/**
 * Viewport-space pipeline. All passes run at the canvas resolution, so cost is independent of the
 * source size; the source is a single mip-mapped full-resolution texture (sharp at 100%, alias-free
 * when zoomed out). Passes: geometry → (blur) → final → canvas.
 */
export class Renderer {
  readonly gl: WebGL2RenderingContext
  readonly maxTextureSize: number
  readonly floatTargets: boolean
  private workFormat: TargetFormat

  private geometry: Program
  private blit: Program
  private blur: Program
  private final: Program
  private cleanup: Program

  private src: WebGLTexture | null = null
  imgW = 0
  imgH = 0

  private size = { w: 0, h: 0 }
  private work: Target | null = null
  private tmpS: Target | null = null
  private blurS: Target | null = null
  private q1: Target | null = null
  private q2: Target | null = null
  private qTmp: Target | null = null
  private blurL: Target | null = null
  private blurR: Target | null = null
  private nrT: Target | null = null
  private workTex: WebGLTexture | null = null
  private curveCache = new Map<string, WebGLTexture>()
  private frame = { zoom: 1, pan: [0, 0] as [number, number], half: [1, 1] as [number, number] }
  private hist: Target
  private probe: Target
  private blank: Target

  private lastState: RenderState | null = null

  constructor(private canvas: AnyCanvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null
    if (!gl) throw new Error('WebGL2 is not available')
    this.gl = gl
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float')
    gl.getExtension('OES_texture_float_linear')

    this.workFormat = this.floatTargets ? 'rgba16f' : 'srgb8'
    const test = new Target(gl, 4, 4, this.workFormat)
    if (!test.isComplete()) this.workFormat = 'srgb8'
    test.dispose()

    this.geometry = new Program(gl, geometrySrc, 'geometry')
    this.blit = new Program(gl, blitSrc, 'blit')
    this.blur = new Program(gl, blurSrc, 'blur')
    this.final = new Program(gl, finalSrc, 'final')
    this.cleanup = new Program(gl, cleanupSrc, 'cleanup')
    this.hist = new Target(gl, HIST_W, HIST_H, 'rgba8')
    this.probe = new Target(gl, 1, 1, 'rgba8')
    this.blank = new Target(gl, 1, 1, this.workFormat)
  }

  // ---- resources ---------------------------------------------------------------------------

  /** Upload a decoded bitmap as the (only) source texture. Caller closes the bitmap afterwards. */
  setSource(bitmap: ImageBitmap, origW: number, origH: number) {
    const gl = this.gl
    this.clearSource()
    const tex = gl.createTexture()!
    const levels = Math.floor(Math.log2(Math.max(bitmap.width, bitmap.height))) + 1
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, bitmap.width, bitmap.height)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4)
    this.src = tex
    this.imgW = origW
    this.imgH = origH
  }

  clearSource() {
    if (this.src) this.gl.deleteTexture(this.src)
    this.src = null
    this.imgW = this.imgH = 0
    this.lastState = null
    this.clearCanvas()
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return
    this.canvas.width = w
    this.canvas.height = h
    this.size = { w, h }
    for (const t of [this.work, this.tmpS, this.blurS, this.q1, this.q2, this.qTmp, this.blurL, this.blurR, this.nrT]) t?.dispose()
    const f = this.workFormat
    const g = this.gl
    const qw = Math.max(1, Math.ceil(w / 4))
    const qh = Math.max(1, Math.ceil(h / 4))
    this.work = new Target(g, w, h, f)
    this.tmpS = new Target(g, w, h, f)
    this.blurS = new Target(g, w, h, f)
    this.q1 = new Target(g, Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2)), f)
    this.q2 = new Target(g, qw, qh, f)
    this.qTmp = new Target(g, qw, qh, f)
    this.blurL = new Target(g, qw, qh, f)
    this.blurR = new Target(g, w, h, f)
    this.nrT = new Target(g, w, h, f)
    if (this.lastState) this.render(this.lastState)
  }

  dispose() {
    this.clearSource()
    for (const t of [this.work, this.tmpS, this.blurS, this.q1, this.q2, this.qTmp, this.blurL, this.blurR, this.nrT, this.hist, this.probe, this.blank]) t?.dispose()
    for (const tex of this.curveCache.values()) this.gl.deleteTexture(tex)
    this.curveCache.clear()
    for (const p of [this.geometry, this.blit, this.blur, this.final, this.cleanup]) p.dispose()
  }

  // ---- drawing -----------------------------------------------------------------------------

  private bindTarget(t: Target | null, w: number, h: number) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null)
    gl.viewport(0, 0, w, h)
  }
  private tex(unit: number, tex: WebGLTexture) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
  }
  private draw() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
  }

  private clearCanvas() {
    const gl = this.gl
    gl.disable(gl.SCISSOR_TEST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private blurPass(src: Target, dst: Target, dx: number, dy: number, sigma: number) {
    this.bindTarget(dst, dst.w, dst.h)
    this.blur.use().i1('uTex', 0).f2('uSize', dst.w, dst.h).f2('uDir', dx, dy).f1('uSigma', sigma)
    this.tex(0, src.tex)
    this.draw()
  }
  private blitPass(src: Target, dst: Target) {
    this.bindTarget(dst, dst.w, dst.h)
    this.blit.use().i1('uTex', 0).f2('uSize', dst.w, dst.h)
    this.tex(0, src.tex)
    this.draw()
  }

  /** 256×1 LUT texture for a tone-curve setting (cached by content). */
  private curveTexture(p: EditParams): WebGLTexture {
    const key = JSON.stringify(p.toneCurve)
    const hit = this.curveCache.get(key)
    if (hit) return hit
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 256, 1)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, buildCurveLUT(p.toneCurve))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (this.curveCache.size > 8) {
      const first = this.curveCache.keys().next().value as string
      gl.deleteTexture(this.curveCache.get(first)!)
      this.curveCache.delete(first)
    }
    this.curveCache.set(key, tex)
    return tex
  }

  private setFinalUniforms(pr: EditParams, clip: boolean) {
    const p = this.final
    const b = pr.basic
    const [gr, gg, gb] = wbGains(b.temp, b.tint)
    const ev = 2 ** b.exposure
    p.f3('uGain', gr * ev, gg * ev, gb * ev)
      .f1('uContrast', b.contrast / 100)
      .f1('uHighlights', b.highlights / 100)
      .f1('uShadows', b.shadows / 100)
      .f1('uWhites', b.whites / 100)
      .f1('uBlacks', b.blacks / 100)
      .f1('uTexture', b.texture / 100)
      .f1('uClarity', b.clarity / 100)
      .f1('uDehaze', b.dehaze / 100)
      .f1('uVibrance', b.vibrance / 100)
      .f1('uSaturation', b.saturation / 100)
      .i1('uClip', clip ? 1 : 0)

    p.i1('uCurveOn', isIdentityCurve(pr.toneCurve) ? 0 : 1)

    const m = pr.mixer
    const anyMix = MIXER_COLORS.some((c) => m.hue[c] || m.sat[c] || m.lum[c])
    p.i1('uMixOn', anyMix ? 1 : 0)
    p.f1v('uMixHue', MIXER_COLORS.map((c) => m.hue[c] / 100))
    p.f1v('uMixSat', MIXER_COLORS.map((c) => m.sat[c] / 100))
    p.f1v('uMixLum', MIXER_COLORS.map((c) => m.lum[c] / 100))

    const g = pr.grading
    const wheels = [g.shadows, g.midtones, g.highlights, g.global].map(wheelOffset)
    p.i1('uGradeOn', gradingActive(g) ? 1 : 0)
    p.f3v('uGradeCol', wheels.flatMap((w) => w.chroma))
    p.f1v('uGradeLum', wheels.map((w) => w.lum))
    p.f1('uBlend', g.blending / 100).f1('uBalance', g.balance / 100)

    const d = pr.detail
    p.f1('uSharpAmt', d.sharpAmount / 150).f1('uSharpDetail', d.sharpDetail / 100).f1('uSharpMask', d.sharpMasking / 100)

    const e = pr.effects
    p.f1('uVigAmt', e.vigAmount / 100)
      .f1('uVigMid', e.vigMid / 100)
      .f1('uVigRound', e.vigRound / 100)
      .f1('uVigFeather', e.vigFeather / 100)
      .f1('uGrainAmt', e.grainAmount / 100)
      .f1('uGrainSize', e.grainSize / 100)
      .f1('uGrainRough', e.grainRough / 100)
  }

  /** Final pass into `target` (null = canvas). uv = uvOffset + fragCoord/size * uvScale. */
  private finalPass(pr: EditParams, target: Target | null, w: number, h: number, uvOff: [number, number], uvScale: [number, number], clip: boolean) {
    this.bindTarget(target, w, h)
    const f = this.frame
    this.final
      .use()
      .i1('uWork', 0)
      .i1('uBlurS', 1)
      .i1('uBlurL', 2)
      .i1('uBlurR', 3)
      .i1('uCurve', 4)
      .f2('uSize', w, h)
      .f2('uUvOffset', ...uvOff)
      .f2('uUvScale', ...uvScale)
      .f2('uViewport', this.size.w, this.size.h)
      .f2('uPan', f.pan[0], f.pan[1])
      .f1('uZoom', f.zoom)
      .f2('uHalfFrame', f.half[0], f.half[1])
    this.setFinalUniforms(pr, clip)
    const work = this.workTex!
    this.tex(0, work)
    this.tex(1, (this.blurS ?? this.work)!.tex)
    this.tex(2, (this.blurL ?? this.work)!.tex)
    this.tex(3, (this.blurR ?? this.work)!.tex)
    this.tex(4, this.curveTexture(pr))
    this.draw()
  }

  render(state: RenderState) {
    if (!this.src || !this.work) return
    const gl = this.gl
    const { w, h } = this.size
    if (w === 0 || h === 0) return
    this.lastState = state
    gl.disable(gl.BLEND)
    gl.disable(gl.SCISSOR_TEST)

    // 1. geometry
    const c = state.params.crop
    const tf = state.params.transform
    const W = this.imgW
    const H = this.imgH
    let cx = c.cx * W
    let cy = c.cy * H
    let hx = (c.w * W) / 2
    let hy = (c.h * H) / 2
    if (state.cropEdit) {
      const [fw, fh] = frameSize(W, H, c.angle)
      cx = W / 2
      cy = H / 2
      hx = fw / 2
      hy = fh / 2
    }
    this.bindTarget(this.work, w, h)
    this.geometry
      .use()
      .i1('uSrc', 0)
      .f2('uSize', w, h)
      .f2('uImg', W, H)
      .f2('uC', cx, cy)
      .f2('uHalf', hx, hy)
      .f1('uAngle', (c.angle * Math.PI) / 180)
      .f1('uZoom', state.zoom)
      .f2('uPan', state.pan[0], state.pan[1])
      .f1('uKv', tf.vertical / 100 * 0.35)
      .f1('uKh', tf.horizontal / 100 * 0.35)
      .f1('uScale', tf.scale / 100)
      .f1('uAspect', tf.aspect / 100)
      .f2('uOff', (tf.xOffset / 100) * W * 0.5, (tf.yOffset / 100) * H * 0.5)
      .f1('uDist', (state.params.lens.distortion / 100) * 0.35)
      .f1('uVigFix', state.params.lens.vignette / 100)
      .f1('uVigMid', state.params.lens.vignetteMid / 100)
    this.tex(0, this.src)
    this.draw()
    this.frame = { zoom: state.zoom, pan: state.pan, half: [hx, hy] }

    // 2. clean-up (noise reduction / defringe), skipped when zoomed far out where it is invisible
    const needs = passNeeds(state.params)
    let source = this.work
    if (needs.cleanup && state.zoom >= 0.35) {
      const d = state.params.detail
      this.bindTarget(this.nrT, w, h)
      this.cleanup
        .use()
        .i1('uTex', 0)
        .f2('uSize', w, h)
        .f1('uLum', d.nrLum / 100)
        .f1('uColor', d.nrColor / 100)
        .f1('uDefringe', state.params.lens.defringe / 100)
      this.tex(0, this.work.tex)
      this.draw()
      source = this.nrT!
    }
    this.workTex = source.tex

    // 3. blurs (only when a presence / sharpening control is active)
    if (needs.blurSmall) {
      const sg = Math.max(0.7, TEXTURE_SIGMA * state.zoom)
      this.blurPass(source, this.tmpS!, 1, 0, sg)
      this.blurPass(this.tmpS!, this.blurS!, 0, 1, sg)
    }
    if (needs.blurSharp) {
      const sg = Math.max(0.5, state.params.detail.sharpRadius * state.zoom)
      this.blurPass(source, this.tmpS!, 1, 0, sg)
      this.blurPass(this.tmpS!, this.blurR!, 0, 1, sg)
    }
    if (needs.blurLarge) {
      this.blitPass(source, this.q1!)
      this.blitPass(this.q1!, this.q2!)
      const sg = Math.max(0.7, (CLARITY_SIGMA * state.zoom) / 4)
      this.blurPass(this.q2!, this.qTmp!, 1, 0, sg)
      this.blurPass(this.qTmp!, this.blurL!, 0, 1, sg)
    }

    // 4. final → canvas (with optional before/after split via scissor)
    this.clearCanvas()
    const { mode, pos } = state.compare
    const after = state.params
    const before = state.before
    // "before" reuses the same blur textures; its texture/clarity/dehaze are zero so they are unused.
    const full: [number, number] = [0, 0]
    const one: [number, number] = [1, 1]
    if (mode === 'off') {
      this.finalPass(after, null, w, h, full, one, state.clipping)
    } else if (mode === 'before') {
      this.finalPass(before, null, w, h, full, one, state.clipping)
    } else {
      gl.enable(gl.SCISSOR_TEST)
      const split = Math.round((mode === 'lr' ? w : h) * pos)
      if (mode === 'lr') {
        gl.scissor(0, 0, split, h)
        this.finalPass(before, null, w, h, full, one, state.clipping)
        gl.scissor(split, 0, w - split, h)
        this.finalPass(after, null, w, h, full, one, state.clipping)
      } else {
        // top = before (GL y is bottom-up)
        gl.scissor(0, h - split, w, split)
        this.finalPass(before, null, w, h, full, one, state.clipping)
        gl.scissor(0, 0, w, h - split)
        this.finalPass(after, null, w, h, full, one, state.clipping)
      }
      gl.disable(gl.SCISSOR_TEST)
    }
  }

  // ---- read-back ---------------------------------------------------------------------------

  /** RGBA8 of the "after" image at low resolution, for the histogram. */
  readHistogramPixels(): Uint8Array | null {
    const s = this.lastState
    if (!s || !this.work) return null
    this.finalPass(s.params, this.hist, HIST_W, HIST_H, [0, 0], [1, 1], false)
    const out = new Uint8Array(HIST_W * HIST_H * 4)
    this.gl.readPixels(0, 0, HIST_W, HIST_H, this.gl.RGBA, this.gl.UNSIGNED_BYTE, out)
    return out
  }

  /** Displayed colour (0..255) at a viewport pixel, or null outside the image. */
  probeRGB(x: number, y: number): [number, number, number] | null {
    const s = this.lastState
    if (!s || !this.work) return null
    const { w, h } = this.size
    if (x < 0 || y < 0 || x >= w || y >= h) return null
    const uv: [number, number] = [(x + 0.5) / w, 1 - (y + 0.5) / h]
    this.finalPass(s.params, this.probe, 1, 1, uv, [0, 0], false)
    const px = new Uint8Array(4)
    this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px)
    return px[3]! < 128 ? null : [px[0]!, px[1]!, px[2]!]
  }

  /** Linear-light, pre-adjustment colour (5×5 average) at a viewport pixel — for the WB picker. */
  probeWork(x: number, y: number): [number, number, number] | null {
    if (!this.work) return null
    const gl = this.gl
    const { w, h } = this.size
    const r = 2
    const x0 = Math.round(x) - r
    const y0 = h - Math.round(y) - 1 - r
    if (x0 < 0 || y0 < 0 || x0 + 2 * r + 1 > w || y0 + 2 * r + 1 > h) return null
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.work.fbo)
    const n = (2 * r + 1) ** 2
    let sum: [number, number, number] = [0, 0, 0]
    let alpha = 0
    if (this.workFormat === 'rgba16f') {
      const buf = new Float32Array(n * 4)
      gl.readPixels(x0, y0, 2 * r + 1, 2 * r + 1, gl.RGBA, gl.FLOAT, buf)
      for (let i = 0; i < n; i++) {
        sum = [sum[0] + buf[i * 4]!, sum[1] + buf[i * 4 + 1]!, sum[2] + buf[i * 4 + 2]!]
        alpha += buf[i * 4 + 3]!
      }
    } else {
      const buf = new Uint8Array(n * 4)
      gl.readPixels(x0, y0, 2 * r + 1, 2 * r + 1, gl.RGBA, gl.UNSIGNED_BYTE, buf)
      const dec = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      for (let i = 0; i < n; i++) {
        sum = [sum[0] + dec(buf[i * 4]! / 255), sum[1] + dec(buf[i * 4 + 1]! / 255), sum[2] + dec(buf[i * 4 + 2]! / 255)]
        alpha += buf[i * 4 + 3]! / 255
      }
    }
    if (alpha < n * 0.9) return null
    return [sum[0] / alpha, sum[1] / alpha, sum[2] / alpha]
  }
}
