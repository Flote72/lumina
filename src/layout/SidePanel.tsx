import type { ReactNode } from 'react'
import { BasicPanel } from '@/develop/BasicPanel'
import { HistogramPanel } from '@/develop/Histogram'
import { PresetsPanel } from '@/develop/left/PresetsPanel'
import { HistoryPanel, SettingsPanel, SnapshotsPanel } from '@/develop/left/SnapshotsHistoryPanels'
import { ExportSettingsPanel, FileNamingPanel, WatermarkPanel } from '@/export/ExportPanels'
import { Navigator } from '@/develop/Navigator'
import { CatalogPanel, MetadataPanel } from '@/library/LibraryPanels'
import { ColorGradingPanel } from '@/develop/panels/ColorGradingPanel'
import { ColorMixerPanel } from '@/develop/panels/ColorMixerPanel'
import { DetailPanel, EffectsPanel, LensPanel, TransformPanel } from '@/develop/panels/SimplePanels'
import { ToneCurvePanel } from '@/develop/panels/ToneCurvePanel'
import { Section } from '@/design-system/Section'
import { useT } from '@/i18n'
import type { ModuleId } from '@/store/ui'
import { LEFT_SECTIONS, RIGHT_SECTIONS } from './sections'

/** Sections whose real content exists; the rest show a "planned for Phase N" note. */
const IMPLEMENTED: Partial<Record<string, ReactNode>> = {
  'library.catalog': <CatalogPanel />,
  'library.metadata': <MetadataPanel />,
  'export.catalog': <CatalogPanel />,
  'export.exportSettings': <ExportSettingsPanel />,
  'export.fileNaming': <FileNamingPanel />,
  'export.watermark': <WatermarkPanel />,
  'develop.navigator': <Navigator />,
  'develop.presets': <PresetsPanel />,
  'develop.snapshots': <SnapshotsPanel />,
  'develop.history': <HistoryPanel />,
  'develop.settings': <SettingsPanel />,
  'develop.histogram': <HistogramPanel />,
  'develop.basic': <BasicPanel />,
  'develop.toneCurve': <ToneCurvePanel />,
  'develop.colorMixer': <ColorMixerPanel />,
  'develop.colorGrading': <ColorGradingPanel />,
  'develop.detail': <DetailPanel />,
  'develop.lens': <LensPanel />,
  'develop.transform': <TransformPanel />,
  'develop.effects': <EffectsPanel />,
}

export function SidePanel({ side, module }: { side: 'left' | 'right'; module: ModuleId }) {
  const t = useT()
  const defs = (side === 'left' ? LEFT_SECTIONS : RIGHT_SECTIONS)[module]
  return (
    <aside aria-label={side === 'left' ? 'Left panel' : 'Right panel'} className="h-full w-full overflow-x-hidden overflow-y-auto bg-bg-1">
      {defs.map((d) => (
        <Section key={`${module}.${d.id}`} id={`${side}.${module}.${d.id}`} title={t(d.title)}>
          {IMPLEMENTED[`${module}.${d.id}`] ?? <p className="px-3 py-1 text-xs text-fg-2">{t('panel.comingIn', { n: d.phase })}</p>}
        </Section>
      ))}
    </aside>
  )
}
