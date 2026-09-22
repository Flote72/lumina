import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_FRAME } from '@/core/export/frame'
import type { ExportOptions } from '@/export/exporter'

export type ExportScope = 'selection' | 'visible' | 'all'

export interface ItemState {
  id: string
  name: string
  status: 'waiting' | 'working' | 'done' | 'error'
  progress: number
  message?: string
}

interface ExportState {
  options: ExportOptions
  template: string
  scope: ExportScope
  /** watermark image as a data URL (kept small) */
  watermarkImage: string | null
  // run state (not persisted)
  running: boolean
  items: ItemState[]
  summary: string | null

  setOptions: (p: Partial<ExportOptions>) => void
  setResize: (p: Partial<ExportOptions['resize']>) => void
  setSharpen: (p: Partial<ExportOptions['sharpen']>) => void
  setWatermark: (p: Partial<ExportOptions['watermark']>) => void
  setFrame: (p: Partial<ExportOptions['frame']>) => void
  setTemplate: (t: string) => void
  setScope: (s: ExportScope) => void
  setWatermarkImage: (d: string | null) => void
  patchItem: (id: string, p: Partial<ItemState>) => void
  setRun: (r: { running?: boolean; items?: ItemState[]; summary?: string | null }) => void
}

export const DEFAULT_EXPORT: ExportOptions = {
  format: 'jpeg',
  quality: 90,
  colorSpace: 'srgb',
  resize: { mode: 'original', longEdge: 2048, percent: 50, width: 1920, height: 1080, noUpscale: true },
  sharpen: { target: 'screen', amount: 'standard' },
  metadata: 'keep',
  copyright: '',
  creator: '',
  watermark: { enabled: false, kind: 'text', text: '© Lumina', position: 'br', sizePct: 18, opacity: 70, marginPct: 3 },
  frame: DEFAULT_FRAME,
}

export const useExportSettings = create<ExportState>()(
  persist(
    (set) => ({
      options: DEFAULT_EXPORT,
      template: '{name}_{seq3}',
      scope: 'selection',
      watermarkImage: null,
      running: false,
      items: [],
      summary: null,

      setOptions: (p) => set((s) => ({ options: { ...s.options, ...p } })),
      setResize: (p) => set((s) => ({ options: { ...s.options, resize: { ...s.options.resize, ...p } } })),
      setSharpen: (p) => set((s) => ({ options: { ...s.options, sharpen: { ...s.options.sharpen, ...p } } })),
      setWatermark: (p) => set((s) => ({ options: { ...s.options, watermark: { ...s.options.watermark, ...p } } })),
      setFrame: (p) => set((s) => ({ options: { ...s.options, frame: { ...s.options.frame, ...p } } })),
      setTemplate: (template) => set({ template }),
      setScope: (scope) => set({ scope }),
      setWatermarkImage: (watermarkImage) => set({ watermarkImage }),
      patchItem: (id, p) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })),
      setRun: (r) => set(r as Partial<ExportState>),
    }),
    {
      name: 'lumina.export',
      version: 1,
      partialize: (s) => ({ options: s.options, template: s.template, scope: s.scope, watermarkImage: s.watermarkImage }),
      // tolerate settings saved by older versions
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ExportState>
        return {
          ...current,
          ...p,
          options: {
            ...DEFAULT_EXPORT,
            ...p.options,
            resize: { ...DEFAULT_EXPORT.resize, ...p.options?.resize },
            sharpen: { ...DEFAULT_EXPORT.sharpen, ...p.options?.sharpen },
            watermark: { ...DEFAULT_EXPORT.watermark, ...p.options?.watermark },
            frame: { ...DEFAULT_EXPORT.frame, ...p.options?.frame },
          },
        }
      },
    },
  ),
)
