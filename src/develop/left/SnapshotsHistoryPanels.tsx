import { useEffect, useState } from 'react'
import { Button } from '@/design-system/Button'
import { useT } from '@/i18n'
import { useClipboard } from '@/store/clipboard'
import { useVisibleIds } from '@/store/library'
import { usePhotos } from '@/store/photos'
import { useSnapshots } from '@/store/snapshots'

export function SnapshotsPanel() {
  const t = useT()
  const id = usePhotos((s) => s.currentId)
  const items = useSnapshots((s) => s.items)
  const [name, setName] = useState('')

  useEffect(() => {
    void useSnapshots.getState().load(id)
  }, [id])

  const add = () => {
    void useSnapshots.getState().add(name || t('snap.default', { n: items.length + 1 }))
    setName('')
  }

  return (
    <div>
      <div className="flex gap-1 px-3 pb-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && id && add()}
          placeholder={t('snap.name')}
          aria-label={t('snap.name')}
          className="h-6 min-w-0 flex-1 rounded-[4px] border border-line bg-bg-2 px-2 text-sm"
        />
        <Button disabled={!id} onClick={add} aria-label={t('snap.add')} title={t('snap.add')}>
          +
        </Button>
      </div>
      {items.length === 0 && <p className="px-3 py-1 text-xs text-fg-2">{t('snap.empty')}</p>}
      <ul>
        {items.map((s) => (
          <li key={s.id} className="group/i flex items-center">
            <button type="button" className="h-6 min-w-0 flex-1 truncate px-3 text-left text-sm text-fg-1 hover:bg-bg-2 hover:text-fg-0" onClick={() => void useSnapshots.getState().apply(s.id)}>
              {s.name}
            </button>
            <button type="button" aria-label={t('snap.delete')} title={t('snap.delete')} className="hidden h-6 w-6 shrink-0 text-fg-2 group-hover/i:block hover:text-danger" onClick={() => void useSnapshots.getState().remove(s.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HistoryPanel() {
  const t = useT()
  const id = usePhotos((s) => s.currentId)
  const h = usePhotos((s) => (s.currentId ? s.history[s.currentId] : undefined))
  const jumpTo = usePhotos((s) => s.jumpTo)
  if (!id || !h) return <p className="px-3 py-1 text-xs text-fg-2">{t('history.empty')}</p>
  const label = (l: string) => (l === 'import' ? t('history.import') : l === 'restore' ? t('history.restore') : l)
  return (
    <ul className="max-h-64 overflow-y-auto">
      {h.entries
        .map((e, i) => ({ e, i }))
        .reverse()
        .map(({ e, i }) => (
          <li key={i}>
            <button
              type="button"
              aria-current={i === h.index}
              onClick={() => jumpTo(i)}
              className={`h-6 w-full truncate px-3 text-left text-sm hover:bg-bg-2 ${i === h.index ? 'text-accent' : i > h.index ? 'text-fg-2' : 'text-fg-1'}`}
            >
              {label(e.label)}
            </button>
          </li>
        ))}
    </ul>
  )
}

export function SettingsPanel() {
  const t = useT()
  const id = usePhotos((s) => s.currentId)
  const copied = useClipboard((s) => !!s.patch)
  const visible = useVisibleIds()
  const { openDialog, paste, applyPrevious } = useClipboard.getState()
  return (
    <div className="grid grid-cols-2 gap-1 px-3 pb-1">
      <Button disabled={!id} onClick={() => openDialog('copy')} title="Ctrl/Cmd+Shift+C">
        {t('settings.copy')}
      </Button>
      <Button disabled={!id || !copied} onClick={() => void paste()} title="Ctrl/Cmd+Shift+V">
        {t('settings.paste')}
      </Button>
      <Button disabled={!id} onClick={() => openDialog('sync')}>
        {t('settings.sync')}
      </Button>
      <Button disabled={!id} onClick={() => void applyPrevious(visible)}>
        {t('settings.previous')}
      </Button>
    </div>
  )
}
