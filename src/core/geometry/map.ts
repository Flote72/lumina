import type { TransformParams } from '../params/params'

/**
 * Viewport ⇄ source-image mapping. `viewportToSource` mirrors `geomMap.glsl` exactly (crop/rotation → transform →
 * perspective → lens distortion), so on-screen handles land on the pixels the shaders evaluate.
 * All viewport coordinates are device pixels with the origin at the top-left.
 */
export interface MapParams {
  /** original image size (px) */
  W: number
  H: number
  /** centre of the visible frame in source px (crop centre, or image centre in crop-edit mode) */
  cx: number
  cy: number
  /** radians, positive = clockwise */
  angle: number
  zoom: number
  panX: number
  panY: number
  /** viewport size (device px) */
  vw: number
  vh: number
  transform: TransformParams
  /** lens distortion slider (-100..100) */
  distortion: number
}

interface Derived {
  ic: [number, number]
  off: [number, number]
  sx: number
  sy: number
  kv: number
  kh: number
  S: number
  diag: number
  dist: number
}

function derive(m: MapParams): Derived {
  const t = m.transform
  const ax = Math.exp((0.35 * t.aspect) / 100)
  const ic: [number, number] = [m.W / 2, m.H / 2]
  return {
    ic,
    off: [(t.xOffset / 100) * m.W * 0.5, (t.yOffset / 100) * m.H * 0.5],
    sx: (t.scale / 100) * ax,
    sy: (t.scale / 100) / ax,
    kv: (t.vertical / 100) * 0.35,
    kh: (t.horizontal / 100) * 0.35,
    S: Math.max(ic[0], ic[1]),
    diag: Math.hypot(ic[0], ic[1]),
    dist: (m.distortion / 100) * 0.35,
  }
}

export function viewportToSource(vx: number, vy: number, m: MapParams): [number, number] {
  const d = derive(m)
  const ox = (vx - m.vw / 2 - m.panX) / m.zoom
  const oy = (vy - m.vh / 2 - m.panY) / m.zoom
  const c = Math.cos(-m.angle)
  const s = Math.sin(-m.angle)
  const p0x = m.cx + ox * c - oy * s
  const p0y = m.cy + ox * s + oy * c
  let ux = (p0x - d.ic[0] - d.off[0]) / d.sx
  let uy = (p0y - d.ic[1] - d.off[1]) / d.sy
  const w = Math.max(1 + (d.kv * uy) / d.S + (d.kh * ux) / d.S, 0.2)
  ux /= w
  uy /= w
  const rd = Math.hypot(ux, uy) / d.diag
  const k = 1 - d.dist * rd * rd
  return [d.ic[0] + ux * k, d.ic[1] + uy * k]
}

/** Inverse of `viewportToSource` (Newton iteration; the map is smooth and near-affine). */
export function sourceToViewport(px: number, py: number, m: MapParams): [number, number] {
  const d = derive(m)
  // first guess: undo rotation / scale / offset, ignoring perspective and distortion
  const ux = (px - d.ic[0]) * d.sx + d.off[0]
  const uy = (py - d.ic[1]) * d.sy + d.off[1]
  const p0x = d.ic[0] + ux
  const p0y = d.ic[1] + uy
  const c = Math.cos(m.angle)
  const s = Math.sin(m.angle)
  const dx = p0x - m.cx
  const dy = p0y - m.cy
  let vx = m.vw / 2 + m.panX + (dx * c - dy * s) * m.zoom
  let vy = m.vh / 2 + m.panY + (dx * s + dy * c) * m.zoom
  const nonlinear = d.kv !== 0 || d.kh !== 0 || d.dist !== 0
  if (!nonlinear) return [vx, vy]
  for (let i = 0; i < 8; i++) {
    const [fx, fy] = viewportToSource(vx, vy, m)
    const ex = fx - px
    const ey = fy - py
    if (Math.abs(ex) + Math.abs(ey) < 1e-3) break
    const h = 0.5
    const [ax, ay] = viewportToSource(vx + h, vy, m)
    const [bx, by] = viewportToSource(vx, vy + h, m)
    const j11 = (ax - fx) / h
    const j21 = (ay - fy) / h
    const j12 = (bx - fx) / h
    const j22 = (by - fy) / h
    const det = j11 * j22 - j12 * j21
    if (Math.abs(det) < 1e-12) break
    vx -= (j22 * ex - j12 * ey) / det
    vy -= (-j21 * ex + j11 * ey) / det
  }
  return [vx, vy]
}
