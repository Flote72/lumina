import { useState } from 'react'
import { Button } from '@/design-system/Button'
import { Section } from '@/design-system/Section'
import { Slider } from '@/design-system/Slider'
import { EmptyState, ErrorState, LoadingState } from '@/design-system/states'
import { detectCapabilities } from '@/platform/capabilities'

const TEMP_GRADIENT = 'linear-gradient(90deg,#3d7bd9,#d8d8d8 50%,#e0a030)'
const TINT_GRADIENT = 'linear-gradient(90deg,#3fae5a,#d8d8d8 50%,#c447a8)'

/** Dev-only reference page (#/design) for the design system. */
export function DesignGallery() {
  const [v, setV] = useState({ exposure: 0, contrast: 25, temp: 0, tint: 0 })
  const set = (k: keyof typeof v) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  return (
    <div className="h-full overflow-y-auto p-6">
      <a href="#" className="text-sm text-accent">← Lumina</a>
      <div className="mt-4 grid max-w-5xl grid-cols-[320px_1fr] gap-8">
        <div className="bg-bg-1">
          <Section id="ds.basic" title="Sliders">
            <Slider label="Temp" min={-100} max={100} value={v.temp} onChange={set('temp')} trackBackground={TEMP_GRADIENT} />
            <Slider label="Tint" min={-100} max={100} value={v.tint} onChange={set('tint')} trackBackground={TINT_GRADIENT} />
            <Slider label="Exposure" min={-5} max={5} step={0.01} value={v.exposure} onChange={set('exposure')} />
            <Slider label="Contrast" min={-100} max={100} value={v.contrast} onChange={set('contrast')} />
            <Slider label="Disabled" min={0} max={100} value={40} defaultValue={40} onChange={() => {}} disabled />
          </Section>
          <Section id="ds.collapsed" title="Collapsed by default" defaultCollapsed>
            <p className="px-3 text-xs text-fg-2">Section body</p>
          </Section>
        </div>
        <div className="space-y-6">
          <div className="flex gap-2">
            <Button>Default</Button>
            <Button variant="primary">Primary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button active>Active</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="grid h-40 grid-cols-3 border border-line">
            <EmptyState title="Empty" body="Empty state body" />
            <LoadingState />
            <ErrorState error={new Error('Example error')} onRetry={() => {}} />
          </div>
          <pre className="font-mono text-xs text-fg-1">{JSON.stringify(detectCapabilities(), null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
