import { useState } from 'react'
import { Button } from '@/design-system/Button'
import { GroupChecklist } from '@/design-system/GroupChecklist'
import { Modal } from '@/design-system/Modal'
import { DEFAULT_COPY_GROUPS, type GroupId } from '@/core/params/groups'
import { useT } from '@/i18n'
import { useClipboard } from '@/store/clipboard'
import { usePresets } from '@/store/presets'

function PickerDialog({ title, onOk, extra, canOk = true }: { title: string; onOk: (g: GroupId[]) => void; extra?: React.ReactNode; canOk?: boolean }) {
  const t = useT()
  const close = useClipboard((s) => s.closeDialog)
  const [groups, setGroups] = useState<GroupId[]>(DEFAULT_COPY_GROUPS)
  return (
    <Modal
      title={title}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>{t('settings.cancel')}</Button>
          <Button variant="primary" disabled={!groups.length || !canOk} onClick={() => onOk(groups)}>
            {t('settings.confirm')}
          </Button>
        </>
      }
    >
      {extra}
      <GroupChecklist value={groups} onChange={setGroups} />
    </Modal>
  )
}

function SavePresetDialog() {
  const t = useT()
  const close = useClipboard((s) => s.closeDialog)
  const user = usePresets((s) => s.user)
  const [name, setName] = useState('')
  const [group, setGroup] = useState(t('preset.groupDefault'))
  const groups = [...new Set(user.map((p) => p.group).filter(Boolean))]
  const field = 'h-7 w-full rounded-[4px] border border-line bg-bg-2 px-2 text-sm'
  return (
    <PickerDialog
      title={t('preset.saveTitle')}
      canOk={!!name.trim()}
      onOk={(g) => {
        void usePresets.getState().saveCurrent(name.trim(), group.trim(), g)
        close()
      }}
      extra={
        <div className="mb-3 grid gap-2">
          <label className="grid gap-1 text-xs text-fg-2">
            {t('preset.name')}
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="grid gap-1 text-xs text-fg-2">
            {t('preset.group')}
            <input className={field} value={group} onChange={(e) => setGroup(e.target.value)} list="preset-groups" />
            <datalist id="preset-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
        </div>
      }
    />
  )
}

/** Mounted once; shows whichever copy/sync/save-preset dialog is open. */
export function ClipboardDialogs() {
  const t = useT()
  const dialog = useClipboard((s) => s.dialog)
  if (dialog === 'copy') return <PickerDialog title={t('settings.copyTitle')} onOk={(g) => useClipboard.getState().copy(g)} />
  if (dialog === 'sync') return <PickerDialog title={t('settings.syncTitle')} onOk={(g) => void useClipboard.getState().sync(g)} />
  if (dialog === 'savePreset') return <SavePresetDialog />
  return null
}
