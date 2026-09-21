import { DevelopCanvas } from '@/develop/DevelopCanvas'
import { EmptyState } from '@/design-system/states'
import { ExportStage } from '@/export/ExportPanels'
import { useT } from '@/i18n'
import { CompareView, SurveyView } from '@/library/CompareSurvey'
import { GridView } from '@/library/GridView'
import { LibraryToolbar } from '@/library/LibraryToolbar'
import { useLibrary } from '@/store/library'
import { usePhotos } from '@/store/photos'
import type { ModuleId } from '@/store/ui'

function LibraryStage() {
  const t = useT()
  const view = useLibrary((s) => s.view)
  const hasCurrent = usePhotos((s) => !!s.currentId)
  return (
    <div className="flex h-full flex-col">
      <LibraryToolbar />
      <div className="min-h-0 flex-1">
        {view === 'grid' && <GridView />}
        {view === 'loupe' && (hasCurrent ? <DevelopCanvas loupe /> : <EmptyState title={t('lib.selectPhoto')} />)}
        {view === 'compare' && <CompareView />}
        {view === 'survey' && <SurveyView />}
      </div>
    </div>
  )
}

export function CenterStage({ module }: { module: ModuleId }) {
  if (module === 'develop') return <main className="h-full min-w-0"><DevelopCanvas /></main>
  if (module === 'library') return <main className="h-full min-w-0 bg-bg-0"><LibraryStage /></main>
  return <main className="h-full min-w-0 bg-bg-0"><ExportStage /></main>
}
