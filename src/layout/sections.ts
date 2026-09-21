import type { TKey } from '@/i18n'
import type { ModuleId } from '@/store/ui'

export interface SectionDef {
  id: string
  title: TKey
  /** Phase in which the section's real content is implemented. */
  phase: 1 | 2 | 3 | 4
}

export const LEFT_SECTIONS: Record<ModuleId, SectionDef[]> = {
  library: [
    { id: 'catalog', title: 'coll.title', phase: 3 },
  ],
  develop: [
    { id: 'navigator', title: 'panel.navigator', phase: 1 },
    { id: 'presets', title: 'panel.presets', phase: 3 },
    { id: 'snapshots', title: 'panel.snapshots', phase: 3 },
    { id: 'history', title: 'panel.history', phase: 3 },
    { id: 'settings', title: 'panel.settings', phase: 3 },
    { id: 'collections', title: 'panel.collections', phase: 3 },
  ],
  export: [{ id: 'catalog', title: 'coll.title', phase: 3 }],
}

export const RIGHT_SECTIONS: Record<ModuleId, SectionDef[]> = {
  library: [
    { id: 'metadata', title: 'panel.metadata', phase: 3 },
  ],
  develop: [
    { id: 'histogram', title: 'panel.histogram', phase: 1 },
    { id: 'basic', title: 'panel.basic', phase: 1 },
    { id: 'toneCurve', title: 'panel.toneCurve', phase: 2 },
    { id: 'colorMixer', title: 'panel.colorMixer', phase: 2 },
    { id: 'colorGrading', title: 'panel.colorGrading', phase: 2 },
    { id: 'detail', title: 'panel.detail', phase: 2 },
    { id: 'lens', title: 'panel.lens', phase: 2 },
    { id: 'transform', title: 'panel.transform', phase: 2 },
    { id: 'effects', title: 'panel.effects', phase: 2 },
  ],
  export: [
    { id: 'exportSettings', title: 'panel.exportSettings', phase: 3 },
    { id: 'fileNaming', title: 'panel.fileNaming', phase: 3 },
    { id: 'watermark', title: 'panel.watermark', phase: 3 },
  ],
}
