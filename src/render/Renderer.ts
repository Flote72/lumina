import { buildCurveLUT, isIdentityCurve } from '@/core/curve/curve'
import { gradingActive, wheelOffset } from '@/core/color/grading'
import { maskShapeKey } from '@/core/mask/create'
import { MAX_MASKS, MAX_REDEYES, MAX_SPOTS, MIXER_COLORS, passNeeds, type EditParams, type Mask, type MaskComponent } from '@/core/params/params'
import { wbGains } from '@/core/color/whiteBalance'
import { frameSize } from '@/core/geometry/crop'
import blitSrc from './shaders/blit.frag.glsl?raw'
import blurSrc from './shaders/blur.frag.glsl?raw'
import cleanupSrc from './shaders/cleanup.frag.glsl?raw'
import finalSrc from './shaders/final.frag.glsl?raw'
import geometrySrc from './shaders/geometry.frag.glsl?raw'
import maskSrc from './shaders/mask.frag.glsl?raw'
import { rasterizeBrush } from './brushRaster'
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
  private maskProg: Program
  private masksTex: WebGLTexture | null = null
  private maskFbo: WebGLFramebuffer | null = null
  private maskKey = ''
  private overlayIdx = -1
  private brushTex = new Map<string, { tex: WebGLTexture; sig: string }>()

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
    this.maskProg = new Program(gl, maskSrc, 'mask')
    this.maskFbo = gl.createFramebuffer()
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

  resize(w: number, h: number, rerender = true) {
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
    if (this.masksTex) g.deleteTexture(this.masksTex)
    this.masksTex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D_ARRAY, this.masksTex)
    g.texStorage3D(g.TEXTURE_2D_ARRAY, 1, g.R8, w, h, MAX_MASKS)
    g.texParameteri(g.TEXTURE_2D_ARRAY, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D_ARRAY, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D_ARRAY, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D_ARRAY, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    this.maskKey = ''
    if (rerender && this.lastState) this.render(this.lastState)
  }

  dispose() {
    this.clearSource()
    for (const t of [this.work, this.tmpS, this.blurS, this.q1, this.q2, this.qTmp, this.blurL, this.blurR, this.nrT, this.hist, this.probe, this.blank]) t?.dispose()
    for (const tex of this.curveCache.values()) this.gl.deleteTexture(tex)
    this.curveCache.clear()
    if (this.masksTex) this.gl.deleteTexture(this.masksTex)
    if (this.maskFbo) this.gl.deleteFramebuffer(this.maskFbo)
    for (const b of this.brushTex.values()) this.gl.deleteTexture(b.tex)
    this.brushTex.clear()
    for (const p of [this.geometry, this.blit, this.blur, this.final, this.cleanup, this.maskProg]) p.dispose()
  }

  /** Uniforms shared by the geometry and mask passes (see geomMap.glsl). */
  private geomUniforms(p: Program, state: RenderState, cx: number, cy: number) {
    const { w, h } = this.size
    const c = state.params.crop
    const tf = state.params.transform
    const W = this.imgW
    const H = this.imgH
    p.f2('uSize', w, h)
      .f2('uImg', W, H)
      .f2('uC', cx, cy)
      .f1('uAngle', (c.angle * Math.PI) / 180)
      .f1('uZoom', state.zoom)
      .f2('uPan', state.pan[0], state.pan[1])
      .f1('uKv', (tf.vertical / 100) * 0.35)
      .f1('uKh', (tf.horizontal / 100) * 0.35)
      .f1('uScale', tf.scale / 100)
      .f1('uAspect', tf.aspect / 100)
      .f2('uOff', (tf.xOffset / 100) * W * 0.5, (tf.yOffset / 100) * H * 0.5)
      .f1('uDist', (state.params.lens.distortion / 100) * 0.35)
  }

  private retouchUniforms(params: EditParams) {
    const W = this.imgW
    const H = this.imgH
    const L = Math.max(W, H)
    const g = this.geometry
    const spots = params.spots.slice(0, MAX_SPOTS)
    g.i1('uSpotN', spots.length)
    if (spots.length) {
      g.f4v('uSpotA', spots.flatMap((s) => [s.x * W, s.y * H, s.sx * W, s.sy * H]))
      g.f4v('uSpotB', spots.flatMap((s) => [s.radius * L, s.feather / 100, s.opacity / 100, s.mode === 'clone' ? 1 : 0]))
    }
    const reds = params.redEyes.slice(0, MAX_REDEYES)
    g.i1('uRedN', reds.length)
    if (reds.length) {
      g.f4v('uRedA', reds.flatMap((r) => [r.x * W, r.y * H, r.radius * L, r.pupil / 100]))
      g.f4v('uRedB', reds.flatMap((r) => [r.darken / 100, 0, 0, 0]))
    }
  }

  /** Texture holding the painted bitmap of a brush component (re-rasterised when its strokes change). */
  private brushTexture(c: Extract<MaskComponent, { kind: 'brush' }>): WebGLTexture {
    const last = c.strokes[c.strokes.length - 1]
    const sig = `${c.base?.data.length ?? 0}:${c.strokes.length}:${last?.points.length ?? 0}:${last ? last.points[last.points.length - 1] : ''}:${c.strokes.reduce((a, s) => a + s.points.length, 0)}`
    const hit = this.brushTex.get(c.id)
    if (hit && hit.sig === sig) return hit.tex
    const gl = this.gl
    const bmp = rasterizeBrush(c.strokes, this.imgW, this.imgH, c.base)
    const tex = hit?.tex ?? gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp.canvas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.brushTex.set(c.id, { tex, sig })
    this.maskKey = '' // force mask layers to be redrawn
    return tex
  }

  /** Render every visible mask into its layer of the mask array (skipped when nothing relevant changed). */
  private renderMasks(state: RenderState, visible: Mask[], cx: number, cy: number) {
    const gl = this.gl
    const { w, h } = this.size
    const p = state.params
    // drop textures of brush components that no longer exist
    const live = new Set(visible.flatMap((m) => m.components.filter((c) => c.kind === 'brush').map((c) => c.id)))
    for (const [id, b] of this.brushTex) {
      if (!live.has(id)) {
        gl.deleteTexture(b.tex)
        this.brushTex.delete(id)
      }
    }
    const geomKey = JSON.stringify([w, h, state.zoom, state.pan, this.imgW, this.imgH, cx, cy, p.crop.angle, p.transform, p.lens, p.spots, p.redEyes, state.cropEdit])
    // brush bitmaps first (they can invalidate the key)
    const brushes = new Map<string, WebGLTexture>()
    for (const m of visible) for (const c of m.components) if (c.kind === 'brush') brushes.set(c.id, this.brushTexture(c))
    const key = `${geomKey}#${visible.map(maskShapeKey).join('~')}`
    if (key === this.maskKey) return
    this.maskKey = key

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFbo)
    gl.viewport(0, 0, w, h)
    const mp = this.maskProg.use().i1('uWork', 0).i1('uBrush0', 1).i1('uBrush1', 2).i1('uBrush2', 3).i1('uBrush3', 4)
    this.geomUniforms(mp, state, cx, cy)
    this.tex(0, this.work!.tex)
    const L = Math.max(this.imgW, this.imgH)
    visible.forEach((m, layer) => {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.masksTex, 0, layer)
      const comps = m.components.slice(0, 12)
      const kind: number[] = []
      const op: number[] = []
      const inv: number[] = []
      const p0: number[] = []
      const p1: number[] = []
      let slot = 0
      const bound: (WebGLTexture | null)[] = [null, null, null, null]
      for (const c of comps) {
        op.push(c.op === 'add' ? 0 : c.op === 'subtract' ? 1 : 2)
        inv.push(c.invert ? 1 : 0)
        switch (c.kind) {
          case 'brush': {
            const s = Math.min(slot++, 3)
            bound[s] = brushes.get(c.id) ?? null
            kind.push(1)
            p0.push(s, 0, 0, 0)
            p1.push(0, 0, 0, 0)
            break
          }
          case 'linear':
            kind.push(2)
            p0.push(c.x0 * this.imgW, c.y0 * this.imgH, c.x1 * this.imgW, c.y1 * this.imgH)
            p1.push(0, 0, 0, 0)
            break
          case 'radial':
            kind.push(3)
            p0.push(c.cx * this.imgW, c.cy * this.imgH, c.rx * L, c.ry * L)
            p1.push(c.angle, c.feather / 100, 0, 0)
            break
          case 'luminance':
            kind.push(4)
            p0.push(c.lo, c.hi, c.smooth, 0)
            p1.push(0, 0, 0, 0)
            break
          case 'color':
            kind.push(5)
            p0.push(c.r, c.g, c.b, 0)
            p1.push(c.range / 100, 0, 0, 0)
            break
        }
      }
      while (kind.length < 12) {
        kind.push(0)
        op.push(0)
        inv.push(0)
        p0.push(0, 0, 0, 0)
        p1.push(0, 0, 0, 0)
      }
      mp.i1('uN', comps.length).i1v('uKind', kind).i1v('uOp', op).i1v('uInv', inv).f4v('uP0', p0).f4v('uP1', p1).i1('uMaskInv', m.invert ? 1 : 0).f1('uAmount', m.amount / 100)
      for (let i = 0; i < 4; i++) this.tex(1 + i, bound[i] ?? this.tex0())
      this.draw()
    })
    // detach the layer so later passes can sample the array
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, null, 0, 0)
  }

  /** A valid (empty) texture to keep unused sampler slots legal. */
  private tex0(): WebGLTexture {
    return this.blank.tex
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

    p.i1('uBW', pr.bw.enabled ? 1 : 0)
    p.f1v('uGrayMix', MIXER_COLORS.map((c) => pr.bw.mix[c] / 100))

    const g = pr.grading
    const wheels = [g.shadows, g.midtones, g.highlights, g.global].map(wheelOffset)
    p.i1('uGradeOn', gradingActive(g) ? 1 : 0)
    p.f3v('uGradeCol', wheels.flatMap((w) => w.chroma))
    p.f1v('uGradeLum', wheels.map((w) => w.lum))
    p.f1('uBlend', g.blending / 100).f1('uBalance', g.balance / 100)

    const d = pr.detail
    p.f1('uSharpAmt', d.sharpAmount / 150).f1('uSharpDetail', d.sharpDetail / 100).f1('uSharpMask', d.sharpMasking / 100)

    const local = pr.masks.filter((m) => m.visible).slice(0, MAX_MASKS)
    p.i1('uMaskN', local.length).i1('uOverlay', this.overlayIdx)
    if (local.length) {
      const pad = <T,>(a: T[], n: number, z: T) => [...a, ...Array<T>(Math.max(0, n - a.length)).fill(z)]
      p.f4v('uLocA', pad(local.flatMap((m) => [m.adjust.contrast / 100, m.adjust.highlights / 100, m.adjust.shadows / 100, m.adjust.saturation / 100]), 48, 0))
      p.f4v('uLocB', pad(local.flatMap((m) => [m.adjust.texture / 100, m.adjust.clarity / 100, m.adjust.dehaze / 100, m.adjust.sharpness / 100]), 48, 0))
      p.f4v('uLocC', pad(local.flatMap((m) => [Math.max(0, m.adjust.noise) / 100, 0, 0, 0]), 48, 0))
      p.f3v(
        'uLocGain',
        pad(
          local.flatMap((m) => {
            const [a, b, c2] = wbGains(m.adjust.temp, m.adjust.tint)
            const k = 2 ** m.adjust.exposure
            return [a * k, b * k, c2 * k]
          }),
          36,
          1,
        ),
      )
    }

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
    if (this.masksTex) {
      const gl = this.gl
      gl.activeTexture(gl.TEXTURE5)
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.masksTex)
      this.final.i1('uMasks', 5)
    }
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
    this.geometry.use().i1('uSrc', 0).f2('uHalf', hx, hy).f1('uVigFix', state.params.lens.vignette / 100).f1('uVigMid', state.params.lens.vignetteMid / 100).f1('uBleed', state.bleed ?? 0).f1('uLod', Math.max(0, Math.log2(1 / (state.zoom * (tf.scale / 100)))))
    this.geomUniforms(this.geometry, state, cx, cy)
    this.retouchUniforms(state.params)
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

    // 2b. local-adjustment masks
    const visible = state.params.masks.filter((m) => m.visible).slice(0, MAX_MASKS)
    this.overlayIdx = state.overlayMaskId ? visible.findIndex((m) => m.id === state.overlayMaskId) : -1
    if (visible.length) this.renderMasks(state, visible, cx, cy)

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
