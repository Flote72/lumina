import { Resizer } from '@/design-system/Resizer'
import { PANEL_LIMITS, useUiStore } from '@/store/ui'
import { CenterStage } from './CenterStage'
import { Filmstrip } from './Filmstrip'
import { SidePanel } from './SidePanel'
import { TopBar } from './TopBar'

export function Shell() {
  const { module, sizes, hidden, setSize } = useUiStore()
  const L = PANEL_LIMITS

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {!hidden.left && (
          <>
            <div style={{ width: sizes.left }} className="shrink-0">
              <SidePanel side="left" module={module} />
            </div>
            <Resizer axis="x" size={sizes.left} min={L.left.min} max={L.left.max} onResize={(v) => setSize('left', v)} onReset={() => setSize('left', L.left.def)} />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CenterStage module={module} />
          </div>
          {!hidden.filmstrip && (
            <>
              <Resizer axis="y" invert size={sizes.filmstrip} min={L.filmstrip.min} max={L.filmstrip.max} onResize={(v) => setSize('filmstrip', v)} onReset={() => setSize('filmstrip', L.filmstrip.def)} />
              <div style={{ height: sizes.filmstrip }} className="shrink-0">
                <Filmstrip />
              </div>
            </>
          )}
        </div>

        {!hidden.right && (
          <>
            <Resizer axis="x" invert size={sizes.right} min={L.right.min} max={L.right.max} onResize={(v) => setSize('right', v)} onReset={() => setSize('right', L.right.def)} />
            <div style={{ width: sizes.right }} className="shrink-0">
              <SidePanel side="right" module={module} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
