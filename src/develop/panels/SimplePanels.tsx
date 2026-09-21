import { useState } from 'react'
import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import { estimateTilt } from '@/core/geometry/autoLevel'
import { useT } from '@/i18n'
import { usePhotos } from '@/store/photos'
import { useToastStore } from '@/store/toast'
import { setCropAngle } from '../cropActions'
import { ParamSlider, ResetButton, SubHeader } from './kit'
import { usePanelReady } from './usePanelReady'

export function DetailPanel() {
  const t = useT()
  const h = t('panel.detail')
  return (
    <div>
      <SubHeader right={<ResetButton sections={['detail']} label={t('detail.reset')} />}>{t('detail.sharpening')}</SubHeader>
      <ParamSlider path={['detail', 'sharpAmount']} label={t('detail.amount')} min={0} max={150} history={h} />
      <ParamSlider path={['detail', 'sharpRadius']} label={t('detail.radius')} min={0.5} max={3} step={0.1} history={h} />
      <ParamSlider path={['detail', 'sharpDetail']} label={t('detail.detail')} min={0} max={100} history={h} />
      <ParamSlider path={['detail', 'sharpMasking']} label={t('detail.masking')} min={0} max={100} history={h} />
      <SubHeader>{t('detail.nr')}</SubHeader>
      <ParamSlider path={['detail', 'nrLum']} label={t('detail.nrLum')} min={0} max={100} history={h} />
      <ParamSlider path={['detail', 'nrColor']} label={t('detail.nrColor')} min={0} max={100} history={h} />
    </div>
  )
}

export function LensPanel() {
  const t = useT()
  const h = t('panel.lens')
  return (
    <div>
      <SubHeader right={<ResetButton sections={['lens']} label={t('lens.reset')} />}>{t('lens.manual')}</SubHeader>
      <ParamSlider path={['lens', 'distortion']} label={t('lens.distortion')} min={-100} max={100} history={h} />
      <ParamSlider path={['lens', 'vignette']} label={t('lens.vignette')} min={-100} max={100} history={h} />
      <ParamSlider path={['lens', 'vignetteMid']} label={t('lens.vignetteMid')} min={0} max={100} history={h} />
      <SubHeader>{t('lens.chromatic')}</SubHeader>
      <ParamSlider path={['lens', 'defringe']} label={t('lens.defringe')} min={0} max={100} history={h} />
    </div>
  )
}

export function TransformPanel() {
  const t = useT()
  const h = t('panel.transform')
  const ready = usePanelReady()
  const id = usePhotos((s) => s.currentId)
  const photo = usePhotos((s) => (s.currentId ? s.photos[s.currentId] : undefined))
  const angle = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.crop.angle : 0)) ?? 0
  const commit = usePhotos((s) => s.commit)
  const [busy, setBusy] = useState(false)

  const autoLevel = async () => {
    if (!photo || !id) return
    setBusy(true)
    let bmp: ImageBitmap | null = null
    try {
      const k = 512 / Math.max(photo.width, photo.height)
      bmp = await createImageBitmap(await usePhotos.getState().getFile(photo.id), { resizeWidth: Math.round(photo.width * k), resizeHeight: Math.round(photo.height * k), resizeQuality: 'medium' })
      const c = new OffscreenCanvas(bmp.width, bmp.height)
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.drawImage(bmp, 0, 0)
      const d = g.getImageData(0, 0, bmp.width, bmp.height).data
      const gray = new Uint8ClampedArray(bmp.width * bmp.height)
      for (let i = 0; i < gray.length; i++) gray[i] = 0.2126 * d[i * 4]! + 0.7152 * d[i * 4 + 1]! + 0.0722 * d[i * 4 + 2]!
      const tilt = estimateTilt(gray, bmp.width, bmp.height)
      if (tilt === null) useToastStore.getState().push(t('tf.autoFail'))
      else {
        setCropAngle(tilt)
        commit(t('tf.autoLevel'))
      }
    } finally {
      bmp?.close()
      setBusy(false)
    }
  }

  return (
    <div>
      <SubHeader right={<ResetButton sections={['transform']} label={t('tf.reset')} />}>{t('panel.transform')}</SubHeader>
      <div className="px-3 pb-1">
        <Button className="w-full" disabled={!ready || busy} onClick={autoLevel}>
          {t('tf.autoLevel')}
        </Button>
      </div>
      <ParamSlider path={['transform', 'vertical']} label={t('tf.vertical')} min={-100} max={100} history={h} />
      <ParamSlider path={['transform', 'horizontal']} label={t('tf.horizontal')} min={-100} max={100} history={h} />
      <Slider label={t('tf.rotate')} min={-45} max={45} step={0.1} value={angle} defaultValue={0} disabled={!ready} onChange={setCropAngle} onCommit={() => commit(t('tf.rotate'))} />
      <ParamSlider path={['transform', 'scale']} label={t('tf.scale')} min={50} max={150} history={h} />
      <ParamSlider path={['transform', 'aspect']} label={t('tf.aspect')} min={-100} max={100} history={h} />
      <ParamSlider path={['transform', 'xOffset']} label={t('tf.x')} min={-100} max={100} history={h} />
      <ParamSlider path={['transform', 'yOffset']} label={t('tf.y')} min={-100} max={100} history={h} />
      <p className="px-3 pt-1 text-2xs text-fg-2">{t('tf.note')}</p>
    </div>
  )
}

export function EffectsPanel() {
  const t = useT()
  const h = t('panel.effects')
  return (
    <div>
      <SubHeader right={<ResetButton sections={['effects']} label={t('fx.reset')} />}>{t('fx.vignette')}</SubHeader>
      <ParamSlider path={['effects', 'vigAmount']} label={t('fx.amount')} min={-100} max={100} history={h} />
      <ParamSlider path={['effects', 'vigMid']} label={t('fx.midpoint')} min={0} max={100} history={h} />
      <ParamSlider path={['effects', 'vigRound']} label={t('fx.roundness')} min={-100} max={100} history={h} />
      <ParamSlider path={['effects', 'vigFeather']} label={t('fx.feather')} min={0} max={100} history={h} />
      <SubHeader>{t('fx.grain')}</SubHeader>
      <ParamSlider path={['effects', 'grainAmount']} label={t('fx.amount')} min={0} max={100} history={h} />
      <ParamSlider path={['effects', 'grainSize']} label={t('fx.gsize')} min={0} max={100} history={h} />
      <ParamSlider path={['effects', 'grainRough']} label={t('fx.rough')} min={0} max={100} history={h} />
    </div>
  )
}
