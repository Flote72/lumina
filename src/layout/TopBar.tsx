import { Button } from '@/design-system/Button'
import { FilmstripIcon, PanelLeftIcon, PanelRightIcon } from '@/design-system/icons'
import { useT, type TKey } from '@/i18n'
import { importFromFiles, importFromFolder } from '@/library/importActions'
import { useUiStore, type ModuleId } from '@/store/ui'

const MODULES: { id: ModuleId; key: TKey; hotkey: string }[] = [
  { id: 'library', key: 'module.library', hotkey: 'G' },
  { id: 'develop', key: 'module.develop', hotkey: 'D' },
  { id: 'export', key: 'module.export', hotkey: '' },
]

export function TopBar() {
  const t = useT()
  const { module, setModule, lang, setLang, hidden, toggleHidden } = useUiStore()

  return (
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-bg-1 px-3">
      <div className="flex items-center gap-2">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-5" />
        <span className="text-base font-semibold tracking-wide">{t('app.name')}</span>
        <Button className="ml-3" onClick={importFromFiles}>
          {t('import.files')}
        </Button>
        <Button variant="ghost" onClick={importFromFolder}>
          {t('import.folder')}
        </Button>
      </div>

      <div role="tablist" aria-label="Module" className="flex items-center gap-1">
        {MODULES.map((m) => {
          const active = module === m.id
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              onClick={() => setModule(m.id)}
              title={m.hotkey ? `${t(m.key)} (${m.hotkey})` : t(m.key)}
              className={`relative h-10 px-3.5 text-sm transition-colors ${active ? 'text-fg-0' : 'text-fg-2 hover:text-fg-1'}`}
            >
              {t(m.key)}
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-1">
        {import.meta.env.DEV && (
          <a href="#/design" className="mr-1 text-2xs text-fg-2 hover:text-fg-0">
            DS
          </a>
        )}
        <Button variant="ghost" active={!hidden.left} aria-label={hidden.left ? t('panel.showLeft') : t('panel.collapseLeft')} onClick={() => toggleHidden('left')}>
          <PanelLeftIcon />
        </Button>
        <Button variant="ghost" active={!hidden.filmstrip} aria-label={t('filmstrip.title')} onClick={() => toggleHidden('filmstrip')}>
          <FilmstripIcon />
        </Button>
        <Button variant="ghost" active={!hidden.right} aria-label={hidden.right ? t('panel.showRight') : t('panel.collapseRight')} onClick={() => toggleHidden('right')}>
          <PanelRightIcon />
        </Button>
        <Button variant="ghost" className="ml-1" onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>
          {t('lang.toggle')}
        </Button>
      </div>
    </header>
  )
}
