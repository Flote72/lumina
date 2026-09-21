import { describe, expect, it } from 'vitest'
import { newComponent, newMask, maskShapeKey } from './create'
import { combine, evalColor, evalLinear, evalLuminance, evalMask, evalRadial, sampleComponent } from './eval'
import type { MaskComponent } from '../params/params'

const W = 4000
const H = 3000

describe('linear gradient', () => {
  const c = { x0: 0.5, y0: 0.2, x1: 0.5, y1: 0.6 }
  it('is 1 before the start, 0 after the end, 0.5 in the middle', () => {
    expect(evalLinear(c, 2000, 0, W, H)).toBe(1)
    expect(evalLinear(c, 2000, 0.2 * H, W, H)).toBe(1)
    expect(evalLinear(c, 2000, 0.6 * H, W, H)).toBe(0)
    expect(evalLinear(c, 2000, H, W, H)).toBe(0)
    expect(evalLinear(c, 2000, 0.4 * H, W, H)).toBeCloseTo(0.5, 6)
  })
  it('is constant along the line direction and works for tilted gradients', () => {
    expect(evalLinear(c, 100, 0.4 * H, W, H)).toBeCloseTo(0.5, 6)
    const tilted = { x0: 0, y0: 0, x1: 1, y1: 1 }
    expect(evalLinear(tilted, W / 2, H / 2, W, H)).toBeCloseTo(0.5, 6)
  })
  it('is monotone from start to end and safe for a zero-length line', () => {
    let prev = 2
    for (let i = 0; i <= 20; i++) {
      const v = evalLinear(c, 2000, (0.2 + 0.4 * (i / 20)) * H, W, H)
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
    }
    expect(evalLinear({ x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5 }, 1, 1, W, H)).toBe(0)
  })
})

describe('radial gradient', () => {
  const c = { cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.1, angle: 0, feather: 50 }
  it('1 in the centre, 0 outside, soft in between', () => {
    expect(evalRadial(c, 0.5 * W, 0.5 * H, W, H)).toBe(1)
    expect(evalRadial(c, 0.5 * W + 0.2 * W * 1.01, 0.5 * H, W, H)).toBe(0)
    const edge = evalRadial(c, 0.5 * W + 0.9 * 0.2 * W, 0.5 * H, W, H)
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(1)
  })
  it('radii are fractions of the long side (ellipse axes)', () => {
    // rx = 0.2*4000 = 800 px, ry = 0.1*4000 = 400 px
    expect(evalRadial(c, 0.5 * W, 0.5 * H + 401, W, H)).toBe(0)
    expect(evalRadial(c, 0.5 * W, 0.5 * H + 300, W, H)).toBeGreaterThan(0)
  })
  it('respects rotation', () => {
    const r = { ...c, angle: Math.PI / 2 }
    expect(evalRadial(r, 0.5 * W, 0.5 * H + 700, W, H)).toBeGreaterThan(0) // long axis now vertical
    expect(evalRadial(r, 0.5 * W + 700, 0.5 * H, W, H)).toBe(0)
  })
  it('feather 0 is a hard edge, 100 fades from the centre', () => {
    const hard = { ...c, feather: 0 }
    expect(evalRadial(hard, 0.5 * W + 0.98 * 800, 0.5 * H, W, H)).toBeCloseTo(1, 1)
    const soft = { ...c, feather: 100 }
    expect(evalRadial(soft, 0.5 * W + 400, 0.5 * H, W, H)).toBeCloseTo(0.5, 1)
  })
})

describe('range masks', () => {
  it('luminance band has soft edges and passes only the range', () => {
    const c = { lo: 0.4, hi: 0.6, smooth: 0.1 }
    expect(evalLuminance(c, 0.5)).toBe(1)
    expect(evalLuminance(c, 0.1)).toBe(0)
    expect(evalLuminance(c, 0.95)).toBe(0)
    const edge = evalLuminance(c, 0.35)
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(1)
    expect(evalLuminance({ lo: 0.5, hi: 0.5, smooth: 0 }, 0.5)).toBeGreaterThanOrEqual(0)
  })
  it('colour range prefers similar hues and widens with range', () => {
    const red = { r: 0.8, g: 0.2, b: 0.2, range: 30 }
    expect(evalColor(red, 0.8, 0.2, 0.2)).toBe(1)
    expect(evalColor(red, 0.2, 0.3, 0.8)).toBe(0)
    const near = evalColor(red, 0.75, 0.3, 0.25)
    expect(near).toBeGreaterThan(0)
    expect(evalColor({ ...red, range: 100 }, 0.75, 0.3, 0.25)).toBeGreaterThanOrEqual(near)
  })
})

describe('combining components', () => {
  it('add is a union, subtract removes, intersect multiplies', () => {
    expect(combine('add', 0, 0.6)).toBeCloseTo(0.6)
    expect(combine('add', 0.5, 0.5)).toBeCloseTo(0.75)
    expect(combine('subtract', 0.8, 0.5)).toBeCloseTo(0.4)
    expect(combine('intersect', 0.8, 0.5)).toBeCloseTo(0.4)
    expect(combine('subtract', 0, 1)).toBe(0)
  })
  it('evalMask applies component invert, mask invert and amount', () => {
    const a: MaskComponent = { ...newComponent('linear'), invert: false }
    const b: MaskComponent = { ...newComponent('radial', 'subtract'), invert: false }
    const mask = { components: [a, b], invert: false, amount: 100 }
    const sample = (c: MaskComponent) => (c.id === a.id ? 1 : 0.25)
    expect(evalMask(mask, sample)).toBeCloseTo(0.75)
    expect(evalMask({ ...mask, invert: true }, sample)).toBeCloseTo(0.25)
    expect(evalMask({ ...mask, amount: 50 }, sample)).toBeCloseTo(0.375)
    const inv = { ...mask, components: [{ ...a, invert: true }] }
    expect(evalMask(inv, () => 1)).toBe(0)
  })
  it('a leading subtract/intersect contributes nothing (nothing to subtract from)', () => {
    const sub = newComponent('radial', 'subtract')
    expect(evalMask({ components: [sub], invert: false, amount: 100 }, () => 1)).toBe(0)
  })
  it('sampleComponent dispatches by kind', () => {
    const lin = newComponent('linear', 'add', 0.5, 0.5)
    expect(sampleComponent(lin, { px: 2000, py: 0, W, H, rgb: [0, 0, 0] })).toBe(1)
    const l = newComponent('luminance')
    expect(sampleComponent(l, { px: 0, py: 0, W, H, rgb: [1, 1, 1] })).toBe(1)
    const br = newComponent('brush')
    expect(sampleComponent(br, { px: 0, py: 0, W, H, rgb: [0, 0, 0], brush: () => 0.4 })).toBe(0.4)
  })
})

describe('mask shape key', () => {
  it('ignores adjustments and names but changes with geometry', () => {
    const m = newMask('A', newComponent('radial'))
    const k = maskShapeKey(m)
    expect(maskShapeKey({ ...m, name: 'B', adjust: { ...m.adjust, exposure: 2 } })).toBe(k)
    const moved = { ...m, components: [{ ...m.components[0]!, cx: 0.7 } as MaskComponent] }
    expect(maskShapeKey(moved)).not.toBe(k)
  })
})
