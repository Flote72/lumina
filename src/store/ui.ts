import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '@/i18n'

export type ModuleId = 'library' | 'develop' | 'export'

export const PANEL_LIMITS = {
  left: { min: 200, max: 480, def: 260 },
  right: { min: 260, max: 520, def: 320 },
  filmstrip: { min: 72, max: 240, def: 110 },
} as const
export type PanelId = keyof typeof PANEL_LIMITS

interface UiState {
  module: ModuleId
  lang: Lang
  sizes: Record<PanelId, number>
  hidden: { left: boolean; right: boolean; filmstrip: boolean }
  /** Collapsed state of sections, keyed by section id. */
  collapsed: Record<string, boolean>
  setModule: (m: ModuleId) => void
  setLang: (l: Lang) => void
  setSize: (p: PanelId, px: number) => void
  toggleHidden: (p: keyof UiState['hidden']) => void
  toggleSection: (id: string) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const initialLang = (): Lang => (navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en')

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      module: 'library',
      lang: initialLang(),
      sizes: { left: PANEL_LIMITS.left.def, right: PANEL_LIMITS.right.def, filmstrip: PANEL_LIMITS.filmstrip.def },
      hidden: { left: false, right: false, filmstrip: false },
      collapsed: {},
      setModule: (module) => set({ module }),
      setLang: (lang) => set({ lang }),
      setSize: (p, px) =>
        set((s) => ({ sizes: { ...s.sizes, [p]: clamp(Math.round(px), PANEL_LIMITS[p].min, PANEL_LIMITS[p].max) } })),
      toggleHidden: (p) => set((s) => ({ hidden: { ...s.hidden, [p]: !s.hidden[p] } })),
      toggleSection: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),
    }),
    { name: 'lumina.ui', version: 1 },
  ),
)
