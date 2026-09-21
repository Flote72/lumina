import { create } from 'zustand'

/** Effective (post-tween) viewport state, published by DevelopCanvas for the Navigator. */
export const useViewInfo = create<{ zoom: number; x: number; y: number; vw: number; vh: number; fit: number }>()(() => ({
  zoom: 1,
  x: 0,
  y: 0,
  vw: 0,
  vh: 0,
  fit: 1,
}))
