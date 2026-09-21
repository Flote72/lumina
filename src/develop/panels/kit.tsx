import type { ReactNode } from 'react'
import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import { createDefaultParams, getIn, setIn, type EditParams } from '@/core/params/params'
import { usePanelReady } from './usePanelReady'
import { usePhotos } from '@/store/photos'

const DEFAULTS = createDefaultParams()

export const SubHeader = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mt-1 flex h-6 items-center justify-between px-3 text-2xs tracking-wide text-fg-2 uppercase">
    <span>{children}</span>
    {right}
  </div>
)

interface ParamSliderProps {
  path: readonly string[]
  label: string
  min: number
  max: number
  step?: number
  bg?: string
  /** adjust the incoming value against the other params (e.g. keep split points ordered) */
  constrain?: (v: number, p: EditParams) => number
  /** history label; defaults to the slider label */
  history?: string
}

/** Slider bound to a numeric edit parameter addressed by path ("effects.vigAmount"). */
export function ParamSlider({ path, label, min, max, step, bg, constrain, history }: ParamSliderProps) {
  const ready = usePanelReady()
  const value = usePhotos((s) => (s.currentId ? getIn(s.params[s.currentId], path) : 0))
  const edit = usePhotos((s) => s.edit)
  const commit = usePhotos((s) => s.commit)
  return (
    <Slider
      label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      defaultValue={getIn(DEFAULTS, path)}
      trackBackground={bg}
      disabled={!ready}
      onChange={(v) => edit((p) => setIn(p, path, constrain ? constrain(v, p) : v))}
      onCommit={() => commit(history ?? label)}
    />
  )
}

/** Reset button that restores whole top-level sections to their defaults. */
export function ResetButton({ sections, label }: { sections: (keyof EditParams)[]; label: string }) {
  const ready = usePanelReady()
  const edit = usePhotos((s) => s.edit)
  const commit = usePhotos((s) => s.commit)
  return (
    <Button
      variant="ghost"
      className="!h-5 !px-1.5 text-2xs normal-case"
      disabled={!ready}
      onClick={() => {
        edit((p) => {
          const d = createDefaultParams()
          const next = { ...p }
          for (const k of sections) (next as Record<string, unknown>)[k] = d[k]
          return next
        })
        commit(label)
      }}
    >
      {label}
    </Button>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div role="tablist" className="mx-3 mb-1 flex rounded-[4px] border border-line bg-bg-0 p-0.5">
      {items.map((i) => (
        <button
          key={i.id}
          role="tab"
          aria-selected={value === i.id}
          onClick={() => onChange(i.id)}
          className={`h-5 flex-1 truncate rounded-[3px] px-1 text-2xs ${value === i.id ? 'bg-bg-3 text-accent' : 'text-fg-2 hover:text-fg-0'}`}
        >
          {i.label}
        </button>
      ))}
    </div>
  )
}
