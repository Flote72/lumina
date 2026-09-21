/**
 * Feature detection. All browser-only capability checks live in `platform/`
 * so a Tauri build can swap this layer out.
 */
export interface Capabilities {
  webgl2: boolean
  floatRenderTarget: boolean
  floatLinearFilter: boolean
  maxTextureSize: number
  offscreenCanvas: boolean
  fileSystemAccess: boolean
  opfs: boolean
  indexedDB: boolean
  displayP3: boolean
}

let cached: Capabilities | null = null

export function detectCapabilities(): Capabilities {
  if (cached) return cached
  let webgl2 = false
  let floatRenderTarget = false
  let floatLinearFilter = false
  let maxTextureSize = 0
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (gl) {
      webgl2 = true
      floatRenderTarget = !!gl.getExtension('EXT_color_buffer_float')
      floatLinearFilter = !!gl.getExtension('OES_texture_float_linear')
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    /* leave defaults */
  }
  cached = {
    webgl2,
    floatRenderTarget,
    floatLinearFilter,
    maxTextureSize,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    fileSystemAccess: 'showDirectoryPicker' in window,
    opfs: !!navigator.storage?.getDirectory,
    indexedDB: 'indexedDB' in window,
    displayP3: window.matchMedia?.('(color-gamut: p3)').matches ?? false,
  }
  return cached
}
