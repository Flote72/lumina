import { useEffect, useRef, useState } from 'react'

export interface ViewValue {
  zoom: number
  x: number
  y: number
}

const ease = (t: number) => 1 - (1 - t) ** 3

/** Follows `target`; tweens (≈160ms) when `smooth`, otherwise snaps. */
export function useAnimatedView(target: ViewValue, smooth: boolean, onTweenStart: () => void): ViewValue {
  const [cur, setCur] = useState(target)
  const curRef = useRef(target)
  const raf = useRef(0)
  const smoothRef = useRef(smooth)
  useEffect(() => {
    smoothRef.current = smooth
  })

  useEffect(() => {
    cancelAnimationFrame(raf.current)
    const from = curRef.current
    const same = from.zoom === target.zoom && from.x === target.x && from.y === target.y
    if (same) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!smoothRef.current || reduce) {
      curRef.current = target
      setCur(target)
      return
    }
    onTweenStart()
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 160)
      const e = ease(k)
      // interpolate zoom in log space so zooming feels uniform
      const v = {
        zoom: Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * e),
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
      }
      curRef.current = k >= 1 ? target : v
      setCur(curRef.current)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.zoom, target.x, target.y])

  return cur
}
