import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import { DEFAULT_BASIC, type BasicParams } from '@/core/params/params'
import { useT, type TKey } from '@/i18n'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'

const TEMP_GRADIENT = 'linear-gradient(90deg,#4a86e0,#cfcfcf 50%,#e6a23a)'
const TINT_GRADIENT = 'linear-gradient(90deg,#4cb868,#cfcfcf 50%,#c455ae)'

interface Def {
  key: keyof BasicParams
  min: number
  max: number
  step?: number
  bg?: string
}

const GROUPS: { title: TKey; items: Def[] }[] = [
  {
    title: 'basic.tone',
    items: [
      { key: 'exposure', min: -5, max: 5, step: 0.01 },
      { key: 'contrast', min: -100, max: 100 },
      { key: 'highlights', min: -100, max: 100 },
      { key: 'shadows', min: -100, max: 100 },
      { key: 'whites', min: -100, max: 100 },
      { key: 'blacks', min: -100, max: 100 },
    ],
  },
  {
    title: 'basic.presence',
    items: [
      { key: 'texture', min: -100, max: 100 },
      { key: 'clarity', min: -100, max: 100 },
      { key: 'dehaze', min: -100, max: 100 },
      { key: 'vibrance', min: -100, max: 100 },
      { key: 'saturation', min: -100, max: 100 },
    ],
  },
]

const SubHeader = ({ children, right }: { children: string; right?: React.ReactNode }) => (
  <div className="mt-1 flex h-6 items-center justify-between px-3 text-2xs tracking-wide text-fg-2 uppercase">
    <span>{children}</span>
    {right}
  </div>
)

export function BasicPanel() {
  const t = useT()
  const basic = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.basic : undefined))
  const edit = usePhotos((s) => s.edit)
  const commit = usePhotos((s) => s.commit)
  const picking = useDevelop((s) => s.picking)
  const setPicking = useDevelop((s) => s.setPicking)
  const loaded = useDevelop((s) => s.loadedId) === usePhotos((s) => s.currentId)

  if (!basic) return <p className="px-3 py-1 text-xs text-fg-2">{t('basic.noPhoto')}</p>

  const set = (key: keyof BasicParams) => (v: number) => edit((p) => ({ ...p, basic: { ...p.basic, [key]: v } }))
  const done = (key: keyof BasicParams) => () => commit(t(`basic.${key}` as TKey))
  const row = (d: Def) => (
    <Slider
      key={d.key}
      label={t(`basic.${d.key}` as TKey)}
      min={d.min}
      max={d.max}
      step={d.step}
      value={basic[d.key]}
      defaultValue={DEFAULT_BASIC[d.key]}
      trackBackground={d.bg}
      onChange={set(d.key)}
      onCommit={done(d.key)}
      disabled={!loaded}
    />
  )

  return (
    <div>
      <SubHeader
        right={
          <span className="flex gap-1 normal-case">
            <Button
              variant="ghost"
              className="!h-5 !px-1.5 text-2xs"
              disabled={!loaded}
              active={picking}
              title={t('basic.picker')}
              aria-label={t('basic.picker')}
              onClick={() => setPicking(!picking)}
            >
              WB ⌖
            </Button>
            <Button
              variant="ghost"
              className="!h-5 !px-1.5 text-2xs"
              disabled={!loaded}
              onClick={() => {
                edit((p) => ({ ...p, basic: { ...p.basic, temp: 0, tint: 0 } }))
                commit(t('basic.asShot'))
              }}
            >
              {t('basic.asShot')}
            </Button>
          </span>
        }
      >
        {t('basic.wb')}
      </SubHeader>
      {row({ key: 'temp', min: -100, max: 100, bg: TEMP_GRADIENT })}
      {row({ key: 'tint', min: -100, max: 100, bg: TINT_GRADIENT })}
      {GROUPS.map((g) => (
        <div key={g.title}>
          <SubHeader>{t(g.title)}</SubHeader>
          {g.items.map(row)}
        </div>
      ))}
      <div className="mt-2 px-3">
        <Button
          className="w-full"
          disabled={!loaded}
          onClick={() => {
            edit((p) => ({ ...p, basic: { ...DEFAULT_BASIC } }))
            commit(t('basic.resetAll'))
          }}
        >
          {t('basic.resetAll')}
        </Button>
      </div>
    </div>
  )
}
