import { ALL_GROUPS, type GroupId } from '@/core/params/groups'
import { useT, type TKey } from '@/i18n'

interface Props {
  value: GroupId[]
  onChange: (v: GroupId[]) => void
  /** groups to offer (default: all) */
  groups?: readonly GroupId[]
}

export function GroupChecklist({ value, onChange, groups = ALL_GROUPS }: Props) {
  const t = useT()
  const toggle = (g: GroupId) => onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g])
  return (
    <div>
      <div className="mb-2 flex gap-3 text-xs">
        <button type="button" className="text-accent hover:underline" onClick={() => onChange([...groups])}>
          {t('settings.all')}
        </button>
        <button type="button" className="text-accent hover:underline" onClick={() => onChange([])}>
          {t('settings.none')}
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {groups.map((g) => (
          <li key={g}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--color-accent)]" checked={value.includes(g)} onChange={() => toggle(g)} />
              {t(`group.${g}` as TKey)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
