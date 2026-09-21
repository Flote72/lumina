import { describe, expect, it } from 'vitest'
import { DEFAULT_CROP } from '../params/params'
import { applyRatio, cropToFrameRect, fitInside, flipRatio, frameRectToCrop, frameSize, isInside, ratioValue, resolveZoom, translateInside } from './crop'

const W = 3000
const H = 2000

describe('crop geometry', () => {
  it('round-trips crop ↔ frame rect', () => {
    const c = { ...DEFAULT_CROP, cx: 0.4, cy: 0.55, w: 0.5, h: 0.4, angle: 7 }
    const back = frameRectToCrop(cropToFrameRect(c, W, H), 7, 'free', W, H)
    expect(back.cx).toBeCloseTo(c.cx, 9)
    expect(back.cy).toBeCloseTo(c.cy, 9)
    expect(back.w).toBeCloseTo(c.w, 9)
  })
  it('frame size grows with rotation', () => {
    expect(frameSize(W, H, 0)).toEqual([W, H])
    const [fw, fh] = frameSize(W, H, 90)
    expect(fw).toBeCloseTo(H, 6)
    expect(fh).toBeCloseTo(W, 6)
  })
  it('full image at angle 0 is inside; rotating makes it not', () => {
    const r = { cx: 0, cy: 0, w: W, h: H }
    expect(isInside(r, 0, W, H)).toBe(true)
    expect(isInside(r, 5, W, H)).toBe(false)
  })
  it('fitInside shrinks a full-size rect after rotation until inside', () => {
    const r = fitInside({ cx: 0, cy: 0, w: W, h: H }, 10, W, H)
    expect(isInside(r, 10, W, H)).toBe(true)
    expect(r.w).toBeLessThan(W)
    expect(r.w / r.h).toBeCloseTo(W / H, 6)
  })
  it('translateInside slides without resizing', () => {
    const r = translateInside({ cx: 1400, cy: 0, w: 1000, h: 800 }, 0, W, H)
    expect(r.w).toBe(1000)
    expect(r.cx + r.w / 2).toBeCloseTo(W / 2, 6)
  })
  it('applyRatio yields the requested ratio inside the image', () => {
    const r = applyRatio({ cx: 0, cy: 0, w: W, h: H }, 1, 0, W, H)
    expect(r.w / r.h).toBeCloseTo(1, 9)
    expect(isInside(r, 0, W, H)).toBe(true)
  })
  it('parses ratios', () => {
    expect(ratioValue('3:2', W, H)).toBeCloseTo(1.5)
    expect(ratioValue('original', W, H)).toBeCloseTo(1.5)
    expect(ratioValue('free', W, H)).toBeNull()
    expect(flipRatio('4:5')).toBe('5:4')
  })
  it('resolves zoom modes', () => {
    expect(resolveZoom('1:1', 3, 800, 600, 4000, 3000)).toBe(1)
    expect(resolveZoom('fill', 3, 800, 600, 4000, 3000)).toBeCloseTo(0.2)
    expect(resolveZoom('fit', 3, 800, 600, 4000, 3000)).toBeCloseTo(0.2 * 0.97)
  })
})
