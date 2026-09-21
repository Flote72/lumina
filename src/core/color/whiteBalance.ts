import { luminance } from './srgb'

/** ln-gain per slider unit. Kept in sync with the shader (gains are computed on the CPU and passed as uniforms). */
export const TEMP_K = 0.005
export const TINT_K = 0.004

/** Linear-light RGB gains for Temp/Tint sliders (-100..100). Luminance-normalised so exposure stays constant. */
export function wbGains(temp: number, tint: number): [number, number, number] {
  const lr = TEMP_K * temp + 0.5 * TINT_K * tint
  const lb = -TEMP_K * temp + 0.5 * TINT_K * tint
  const lg = -TINT_K * tint
  const g = [Math.exp(lr), Math.exp(lg), Math.exp(lb)] as [number, number, number]
  const n = luminance(g[0], g[1], g[2])
  return [g[0] / n, g[1] / n, g[2] / n]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Closed-form inverse: Temp/Tint that make the sampled linear colour neutral. */
export function solveWB(r: number, g: number, b: number): { temp: number; tint: number } {
  const lr = Math.log(Math.max(r, 1e-4))
  const lg = Math.log(Math.max(g, 1e-4))
  const lb = Math.log(Math.max(b, 1e-4))
  const temp = (lb - lr) / (2 * TEMP_K)
  const tint = (2 * lg - lr - lb) / (3 * TINT_K)
  return { temp: Math.round(clamp(temp, -100, 100)), tint: Math.round(clamp(tint, -100, 100)) }
}
