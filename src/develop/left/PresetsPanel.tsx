import { useMemo, useRef } from 'react'
import { Button } from '@/design-system/Button'
import { patchGroups } from '@/core/params/groups'
import { useT, type TKey } from '@/i18n'
import { download } from '@/platform/download'
import { useClipboard } from '@/store/clipboard'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import { applyPreset, builtinItems, usePresets, type PresetItem } from '@/store/presets'
import { useUiStore } from '@/store/ui'

export function PresetsPanel() {
  const t = useT()
  const lang = useUiStore((s) => s.lang)
  const user = usePresets((s) => s.user)
  const hasPhoto = usePhotos((s) => !!s.currentId)
  const ready = useDevelop((s) => s.loadedId) === usePhotos((s) => s.currentId)
  const setPreview = useDevelop((s) => s.setPreview)
  const fileRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(() => {
    const items: PresetItem[] = [
      ...builtinItems(lang),
      ...user.map((p) => ({ id: p.id, name: p.name, group: p.group || t('preset.groupDefault'), patch: p.patch as PresetItem['patch'], builtin: false })),
    ]
    const map = new Map<string, PresetItem[]>()
    for (const i of items) map.set(i.group, [...(map.get(i.group) ?? []), i])
    return [...map.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, user])

  return (
    <div>
      <div className="flex flex-wrap gap-1 px-3 pb-1">
        <Button className="!h-5 text-2xs" disabled={!hasPhoto} onClick={() => useClipboard.getState().openDialog('savePreset')}>
          {t('preset.save')}
        </Button>
        <Button className="!h-5 text-2xs" onClick={() => fileRef.current?.click()}>
          {t('preset.import')}
        </Button>
        <Button className="!h-5 text-2xs" disabled={!user.length} onClick={() => download(usePresets.getState().exportJson(), 'lumina-presets.json')}>
          {t('preset.export')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".xmp,.lrtemplate,.json,application/json,application/xml,text/xml"
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            void usePresets.getState().importFiles(files, { apply: true })
          }}
        />
      </div>
      <p className="px-3 pb-1 text-2xs text-fg-2">{hasPhoto ? `${t('preset.hint')} ${t('preset.dropHint')}` : t('preset.noPhoto')}</p>
      {groups.map(([group, items]) => (
        <details key={group} open={group === groups[0]?.[0] || items.some((i) => !i.builtin)} className="group/d">
          <summary className="flex h-6 cursor-pointer list-none items-center gap-1 px-3 text-xs text-fg-1 select-none hover:text-fg-0 [&::-webkit-details-marker]:hidden">
            <span className="text-2xs text-fg-2 transition-transform group-open/d:rotate-90">▸</span>
            {group}
            <span className="text-2xs text-fg-2">{items.length}</span>
          </summary>
          <ul>
            {items.map((p) => (
              <li key={p.id} className="group/i flex items-center">
                <button
                  type="button"
                  disabled={!hasPhoto || !ready}
                  className="h-6 min-w-0 flex-1 truncate pr-2 pl-7 text-left text-sm text-fg-1 hover:bg-bg-2 hover:text-fg-0 disabled:opacity-50"
                  title={patchGroups(p.patch).map((g) => t(`group.${g}` as TKey)).join(', ')}
                  onPointerEnter={() => setPreview(p.patch)}
                  onPointerLeave={() => setPreview(null)}
                  onFocus={() => setPreview(p.patch)}
                  onBlur={() => setPreview(null)}
                  onClick={() => {
                    setPreview(null)
                    void applyPreset(p)
                  }}
                >
                  {p.name}
                </button>
                {!p.builtin && (
                  <button type="button" aria-label={t('preset.delete')} title={t('preset.delete')} className="hidden h-6 w-6 shrink-0 text-fg-2 group-hover/i:block hover:text-danger" onClick={() => void usePresets.getState().remove(p.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
