import type { ReactNode } from 'react'
import { BasicPanel } from '@/develop/BasicPanel'
import { HistogramPanel } from '@/develop/Histogram'
import { Navigator } from '@/develop/Navigator'
import { Section } from '@/design-system/Section'
import { useT } from '@/i18n'
import type { ModuleId } from '@/store/ui'
import { LEFT_SECTIONS, RIGHT_SECTIONS } from './sections'

/** Sections whose real content exists; the rest show a "planned for Phase N" note. */
const IMPLEMENTED: Partial<Record<string, ReactNode>> = {
  'develop.navigator': <Navigator />,
  'develop.histogram': <HistogramPanel />,
  'develop.basic': <BasicPanel />,
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
