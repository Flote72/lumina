import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import { suggestSource } from '@/core/retouch/suggest'
import { useT } from '@/i18n'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import { usePanelReady } from '../panels/usePanelReady'
import { commitEdit, removeRedEye, removeSpot, updateRedEye, updateSpot } from './maskActions'
import { getPreview } from './previewImage'

const SubHeader = ({ children }: { children: string }) => <div className="mt-1 px-3 py-1 text-2xs tracking-wide text-fg-2 uppercase">{children}</div>

export function RetouchPanel() {
  const t = useT()
  const ready = usePanelReady()
  const id = usePhotos((s) => s.currentId)
  const spots = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.spots : undefined)) ?? []
  const eyes = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.redEyes : undefined)) ?? []
  const tool = useDevelop((s) => s.tool)
  const spotSel = useDevelop((s) => s.spotSel)
  const redSel = useDevelop((s) => s.redSel)
  const spot = useDevelop((s) => s.spot)
  const red = useDevelop((s) => s.red)
  const { setTool, setSpot, setSpotSel, setRed, setRedSel } = useDevelop.getState()

  const selSpot = spots.find((s) => s.id === spotSel)
  const selEye = eyes.find((r) => r.id === redSel)

  // sliders edit the selected item as well as the defaults for new ones
  const spotVal = (k: 'feather' | 'opacity') => selSpot?.[k] ?? spot[k]
  const setSpotVal = (k: 'feather' | 'opacity', v: number) => {
    setSpot({ [k]: v })
    if (selSpot) updateSpot(selSpot.id, { [k]: v })
  }
  const sizeVal = (selSpot?.radius ?? spot.radius) * 100

  return (
    <div className="pb-2">
      <SubHeader>{t('spot.title')}</SubHeader>
      <div className="flex gap-1 px-3 pb-1">
        <Button className="flex-1" disabled={!ready} active={tool === 'spot'} onClick={() => setTool(tool === 'spot' ? null : 'spot')}>
          {t('tool.spot')}
        </Button>
      </div>
      {tool === 'spot' && <p className="px-3 pb-1 text-2xs text-accent">{t('spot.hint')}</p>}
      <div className="flex gap-1 px-3 pb-1">
        {(['heal', 'clone'] as const).map((m) => (
          <Button
            key={m}
            className="flex-1"
            active={(selSpot?.mode ?? spot.mode) === m}
            onClick={() => {
              setSpot({ mode: m })
              if (selSpot) {
                updateSpot(selSpot.id, { mode: m })
                commitEdit('Spot')
              }
            }}
          >
            {t(`spot.${m}`)}
          </Button>
        ))}
      </div>
      <Slider
        label={t('spot.size')}
        min={0.4}
        max={12}
        step={0.1}
        value={Math.round(sizeVal * 10) / 10}
        defaultValue={2}
        onChange={(v) => {
          setSpot({ radius: v / 100 })
          if (selSpot) updateSpot(selSpot.id, { radius: v / 100 })
        }}
        onCommit={() => selSpot && commitEdit('Spot')}
      />
      <Slider label={t('spot.feather')} min={0} max={100} value={spotVal('feather')} defaultValue={50} onChange={(v) => setSpotVal('feather', v)} onCommit={() => selSpot && commitEdit('Spot')} />
      <Slider label={t('spot.opacity')} min={0} max={100} value={spotVal('opacity')} defaultValue={100} onChange={(v) => setSpotVal('opacity', v)} onCommit={() => selSpot && commitEdit('Spot')} />
      {spots.length > 0 && (
        <>
          <div className="flex items-center justify-between px-3 pt-1 text-xs text-fg-2">
            <span>{t('spot.list', { n: spots.length })}</span>
            <span className="flex gap-1">
              <Button
                variant="ghost"
                className="!h-5 !px-1.5 text-2xs"
                disabled={!selSpot || !id}
                onClick={() => {
                  if (!selSpot || !id) return
                  void getPreview(id).then((pv) => {
                    const s = suggestSource({ data: pv.gray, w: pv.w, h: pv.h }, selSpot.x, selSpot.y, selSpot.radius)
                    updateSpot(selSpot.id, { sx: s.x, sy: s.y })
                    commitEdit('Spot')
                  })
                }}
              >
                {t('spot.autoSource')}
              </Button>
              <Button variant="ghost" className="!h-5 !px-1.5 text-2xs" disabled={!selSpot} onClick={() => selSpot && removeSpot(selSpot.id)}>
                {t('spot.delete')}
              </Button>
            </span>
          </div>
          <ul>
            {spots.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`h-6 w-full px-3 text-left text-xs ${s.id === spotSel ? 'bg-bg-3 text-accent' : 'text-fg-1 hover:bg-bg-2'}`}
                  onClick={() => {
                    setTool('spot')
                    setSpotSel(s.id)
                  }}
                >
                  {i + 1} · {t(`spot.${s.mode}`)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <SubHeader>{t('red.title')}</SubHeader>
      <div className="flex gap-1 px-3 pb-1">
        <Button className="flex-1" disabled={!ready} active={tool === 'redeye'} onClick={() => setTool(tool === 'redeye' ? null : 'redeye')}>
          {t('tool.redeye')}
        </Button>
      </div>
      {tool === 'redeye' && <p className="px-3 pb-1 text-2xs text-accent">{t('red.hint')}</p>}
      <Slider
        label={t('red.pupil')}
        min={0}
        max={100}
        value={selEye?.pupil ?? red.pupil}
        defaultValue={50}
        onChange={(v) => {
          setRed({ pupil: v })
          if (selEye) updateRedEye(selEye.id, { pupil: v })
        }}
        onCommit={() => selEye && commitEdit('Red-eye')}
      />
      <Slider
        label={t('red.darken')}
        min={0}
        max={100}
        value={selEye?.darken ?? red.darken}
        defaultValue={50}
        onChange={(v) => {
          setRed({ darken: v })
          if (selEye) updateRedEye(selEye.id, { darken: v })
        }}
        onCommit={() => selEye && commitEdit('Red-eye')}
      />
      {eyes.length > 0 && (
        <>
          <div className="flex items-center justify-between px-3 pt-1 text-xs text-fg-2">
            <span>{t('red.list', { n: eyes.length })}</span>
            <Button variant="ghost" className="!h-5 !px-1.5 text-2xs" disabled={!selEye} onClick={() => selEye && removeRedEye(selEye.id)}>
              {t('red.delete')}
            </Button>
          </div>
          <ul>
            {eyes.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`h-6 w-full px-3 text-left text-xs ${r.id === redSel ? 'bg-bg-3 text-accent' : 'text-fg-1 hover:bg-bg-2'}`}
                  onClick={() => {
                    setTool('redeye')
                    setRedSel(r.id)
                  }}
                >
                  {i + 1} · {t('red.title')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
