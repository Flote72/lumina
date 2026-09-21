import type { ReactNode } from 'react'
import { useUiStore } from '@/store/ui'
import { ChevronIcon } from './icons'

interface SectionProps {
  /** Stable id; collapsed state is persisted under it. */
  id: string
  title: string
  children: ReactNode
  actions?: ReactNode
  defaultCollapsed?: boolean
}

export function Section({ id, title, children, actions, defaultCollapsed = false }: SectionProps) {
  const stored = useUiStore((s) => s.collapsed[id])
  const toggle = useUiStore((s) => s.toggleSection)
  const collapsed = stored ?? defaultCollapsed
  // toggleSection flips the stored value; seed it from the default on first use
  const onToggle = () => {
    if (stored === undefined && defaultCollapsed) useUiStore.setState((s) => ({ collapsed: { ...s.collapsed, [id]: true } }))
    toggle(id)
  }
  const bodyId = `sec-${id}`

  return (
    <section className="border-b border-line">
      <div className="flex h-7 items-center pr-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-3 text-left text-2xs font-semibold tracking-[0.06em] text-fg-1 uppercase hover:text-fg-0"
        >
          <ChevronIcon
            className="shrink-0 transition-transform duration-150"
            style={{ transform: collapsed ? 'none' : 'rotate(90deg)', width: 10, height: 10 }}
          />
          <span className="truncate">{title}</span>
        </button>
        {actions}
      </div>
      <div
        id={bodyId}
        className="grid transition-[grid-template-rows] duration-200 ease-out-soft"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
        inert={collapsed}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-2">{children}</div>
        </div>
      </div>
    </section>
  )
}
