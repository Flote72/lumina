import vertSrc from './shaders/fullscreen.vert.glsl?raw'
import geomMap from './shaders/geomMap.glsl?raw'

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

export class Program {
  readonly prog: WebGLProgram
  private locs = new Map<string, WebGLUniformLocation | null>()

  constructor(private gl: WebGL2RenderingContext, fragSrc: string, name: string) {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`Shader "${name}" failed: ${gl.getShaderInfoLog(sh)}`)
      }
      return sh
    }
    const vs = compile(gl.VERTEX_SHADER, vertSrc)
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc.replace('//#include geomMap', geomMap))
    this.prog = gl.createProgram()!
    gl.attachShader(this.prog, vs)
    gl.attachShader(this.prog, fs)
    gl.linkProgram(this.prog)
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw new Error(`Program "${name}" link failed: ${gl.getProgramInfoLog(this.prog)}`)
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
  }

  use() {
    this.gl.useProgram(this.prog)
    return this
  }
  private loc(n: string) {
    if (!this.locs.has(n)) this.locs.set(n, this.gl.getUniformLocation(this.prog, n))
    return this.locs.get(n) ?? null
  }
  f1(n: string, v: number) {
    this.gl.uniform1f(this.loc(n), v)
    return this
  }
  f2(n: string, x: number, y: number) {
    this.gl.uniform2f(this.loc(n), x, y)
    return this
  }
  f3(n: string, x: number, y: number, z: number) {
    this.gl.uniform3f(this.loc(n), x, y, z)
    return this
  }
  f1v(n: string, v: number[]) {
    this.gl.uniform1fv(this.loc(`${n}[0]`), v)
    return this
  }
  i1v(n: string, v: number[]) {
    this.gl.uniform1iv(this.loc(`${n}[0]`), v)
    return this
  }
  f4v(n: string, v: number[]) {
    this.gl.uniform4fv(this.loc(`${n}[0]`), v)
    return this
  }
  f3v(n: string, v: number[]) {
    this.gl.uniform3fv(this.loc(`${n}[0]`), v)
    return this
  }
  i1(n: string, v: number) {
    this.gl.uniform1i(this.loc(n), v)
    return this
  }
  dispose() {
    this.gl.deleteProgram(this.prog)
  }
}

export type TargetFormat = 'rgba16f' | 'srgb8' | 'rgba8'

export class Target {
  tex: WebGLTexture
  fbo: WebGLFramebuffer
  constructor(
    private gl: WebGL2RenderingContext,
    public w: number,
    public h: number,
    public format: TargetFormat,
  ) {
    this.tex = gl.createTexture()!
    this.fbo = gl.createFramebuffer()!
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    const internal = format === 'rgba16f' ? gl.RGBA16F : format === 'srgb8' ? gl.SRGB8_ALPHA8 : gl.RGBA8
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0)
  }
  isComplete() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo)
    return this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) === this.gl.FRAMEBUFFER_COMPLETE
  }
  dispose() {
    this.gl.deleteTexture(this.tex)
    this.gl.deleteFramebuffer(this.fbo)
  }
}
