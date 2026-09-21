import { describe, expect, it } from 'vitest'
import { clamp, decimalsOf, fillRange, parseInput, snap, valueFromPointer } from './sliderMath'

describe('sliderMath', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
  })
  it('derives decimals from step', () => {
    expect(decimalsOf(1)).toBe(0)
    expect(decimalsOf(0.01)).toBe(2)
    expect(decimalsOf(0.5)).toBe(1)
  })
  it('snaps without float noise', () => {
    expect(snap(0.30000000000000004, -5, 5, 0.01)).toBe(0.3)
    expect(snap(2.4, -100, 100, 1)).toBe(2)
    expect(snap(999, -100, 100, 1)).toBe(100)
  })
  it('maps pointer to value', () => {
    expect(valueFromPointer(150, 100, 100, -100, 100, 1)).toBe(0)
    expect(valueFromPointer(0, 100, 100, -100, 100, 1)).toBe(-100)
    expect(valueFromPointer(500, 100, 100, -100, 100, 1)).toBe(100)
  })
  it('fills from the default value in either direction', () => {
    expect(fillRange(50, 0, -100, 100)).toEqual([0.5, 0.75])
    expect(fillRange(-50, 0, -100, 100)).toEqual([0.25, 0.5])
  })
  it('parses input', () => {
    expect(parseInput(' 1,5 ')).toBe(1.5)
    expect(parseInput('')).toBeNull()
    expect(parseInput('abc')).toBeNull()
  })
})
