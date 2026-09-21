/** Pure helpers for the Slider component (unit-tested). */

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Number of decimals implied by a step (0.01 → 2). */
export function decimalsOf(step: number): number {
  const s = String(step)
  if (s.includes('e-')) return Number(s.split('e-')[1])
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

/** Snap to the step grid anchored at `min`, clamp, and strip float noise. */
export function snap(v: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((v - min) / step) * step
  return Number(clamp(snapped, min, max).toFixed(decimalsOf(step)))
}

/** Map a pointer x inside a track to a value. */
export function valueFromPointer(x: number, left: number, width: number, min: number, max: number, step: number): number {
  const t = width <= 0 ? 0 : clamp((x - left) / width, 0, 1)
  return snap(min + t * (max - min), min, max, step)
}

/** Fill segment [from,to] as fractions 0..1, anchored at the default value. */
export function fillRange(value: number, def: number, min: number, max: number): [number, number] {
  const f = (v: number) => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1))
  const a = f(def)
  const b = f(value)
  return a <= b ? [a, b] : [b, a]
}

/** Parse user-typed text; returns null when not a finite number. */
export function parseInput(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(n) ? n : null
}
