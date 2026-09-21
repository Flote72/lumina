import { useEffect } from 'react'
import { EmptyState } from '@/design-system/states'
import { useT } from '@/i18n'
import { useLibrary, useVisibleIds } from '@/store/library'
import { usePhotos } from '@/store/photos'
import { FlagBadge, OriginalImage, Stars } from './PhotoBits'

function Caption({ id }: { id: string }) {
  const p = usePhotos((s) => s.photos[id])
  if (!p) return null
  return (
    <div className="flex h-6 shrink-0 items-center justify-between px-2 text-xs text-fg-1">
      <span className="truncate">{p.name}</span>
      <span className="flex items-center gap-2">
        <Stars value={p.rating} />
        <FlagBadge flag={p.flag} />
      </span>
    </div>
  )
}

/** Two photos side by side: the selected one and a candidate (← / → changes the candidate). */
export function CompareView() {
  const t = useT()
  const ids = useVisibleIds()
  const cur = usePhotos((s) => s.currentId)
  const candidate = useLibrary((s) => s.compareCandidate)
  const setCandidate = useLibrary((s) => s.setCompareCandidate)

  const selectedId = cur && ids.includes(cur) ? cur : ids[0]
  const others = ids.filter((i) => i !== selectedId)
  const right = candidate && others.includes(candidate) ? candidate : others[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (!right || others.length < 2) return
      e.preventDefault()
      e.stopImmediatePropagation()
      const i = others.indexOf(right)
      setCandidate(others[(i + (e.key === 'ArrowRight' ? 1 : -1) + others.length) % others.length]!)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [others, right, setCandidate])

  if (!selectedId || !right) return <EmptyState title={t('lib.needTwo')} />
  return (
    <div className="flex h-full flex-col">
      <p className="px-3 py-1 text-2xs text-fg-2">{t('lib.compareHint')}</p>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-line">
        {[selectedId, right].map((id) => (
          <div key={id} className="flex min-h-0 flex-col bg-bg-0">
            <Caption id={id} />
            <div className="min-h-0 flex-1 p-2">
              <OriginalImage id={id} className="size-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** All selected photos (or the visible ones when nothing is selected) in one screen. */
export function SurveyView() {
  const t = useT()
  const ids = useVisibleIds()
  const selection = useLibrary((s) => s.selection)
  const shown = (selection.length > 1 ? ids.filter((i) => selection.includes(i)) : ids).slice(0, 12)
  if (!shown.length) return <EmptyState title={t('lib.selectPhoto')} />
  const cols = Math.ceil(Math.sqrt(shown.length * 1.4))
  return (
    <div className="flex h-full flex-col">
      <p className="px-3 py-1 text-2xs text-fg-2">{t('lib.surveyHint')}</p>
      <div className="grid min-h-0 flex-1 gap-px bg-line" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
        {shown.map((id) => (
          <div key={id} className="flex min-h-0 min-w-0 flex-col bg-bg-0">
            <Caption id={id} />
            <div className="min-h-0 flex-1 p-1.5">
              <OriginalImage id={id} className="size-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
