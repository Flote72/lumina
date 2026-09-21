import { DevelopCanvas } from '@/develop/DevelopCanvas'
import { Button } from '@/design-system/Button'
import { EmptyState } from '@/design-system/states'
import { useT } from '@/i18n'
import { importFromFiles, importFromFolder } from '@/library/importActions'
import { usePhotos } from '@/store/photos'
import type { ModuleId } from '@/store/ui'

export function CenterStage({ module }: { module: ModuleId }) {
  const t = useT()
  const count = usePhotos((s) => s.order.length)

  if (module === 'develop') return <main className="h-full min-w-0"><DevelopCanvas /></main>

  const importButtons = (
    <div className="flex gap-2">
      <Button variant="primary" onClick={importFromFiles}>
        {t('import.files')}
      </Button>
      <Button onClick={importFromFolder}>{t('import.folder')}</Button>
    </div>
  )

  return (
    <main className="h-full min-w-0 bg-bg-0">
      {module === 'library' ? (
        <EmptyState
          title={count ? `${count}` : t('empty.library.title')}
          body={count ? t('library.photosHint', { n: count }) : t('empty.library.body')}
          action={importButtons}
        />
      ) : (
        <EmptyState title={t('empty.export.title')} body={t('empty.export.body')} />
      )}
    </main>
  )
}
