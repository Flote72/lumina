import { useState } from 'react'
import { Button } from '@/design-system/Button'
import { MIXER_COLORS, type MixerColor } from '@/core/params/params'
import { useT, type TKey } from '@/i18n'
import { useDevelop } from '@/store/develop'
import { ParamSlider, ResetButton, SubHeader, Tabs } from './kit'
import { usePanelReady } from './usePanelReady'

type Mode = 'hue' | 'sat' | 'lum'
const COLOR: Record<MixerColor, string> = {
  red: '#e0453a',
  orange: '#e58a2e',
  yellow: '#dccb3a',
  green: '#4cb85a',
  aqua: '#3ab8b0',
  blue: '#4a6fe0',
  purple: '#8a56d8',
  magenta: '#d04fb0',
}
const NEIGHBOR = (c: MixerColor, d: number) => COLOR[MIXER_COLORS[(MIXER_COLORS.indexOf(c) + d + 8) % 8]!]

function track(mode: Mode, c: MixerColor) {
  if (mode === 'hue') return `linear-gradient(90deg,${NEIGHBOR(c, -1)},${COLOR[c]},${NEIGHBOR(c, 1)})`
  if (mode === 'sat') return `linear-gradient(90deg,#808080,${COLOR[c]})`
  return `linear-gradient(90deg,#1c1c1c,${COLOR[c]},#f0f0f0)`
}

export function ColorMixerPanel() {
  const t = useT()
  const ready = usePanelReady()
  const [mode, setMode] = useState<Mode>('hue')
  const target = useDevelop((s) => s.mixerTarget)
  const setTarget = useDevelop((s) => s.setMixerTarget)

  return (
    <div>
      <SubHeader
        right={
          <span className="flex gap-1">
            <Button variant="ghost" className="!h-5 !px-1.5 text-2xs normal-case" disabled={!ready} active={target === mode} title={t('mixer.target')} aria-label={t('mixer.target')} onClick={() => setTarget(target === mode ? null : mode)}>
              ⌖
            </Button>
            <ResetButton sections={['mixer']} label={t('mixer.reset')} />
          </span>
        }
      >
        HSL
      </SubHeader>
      <Tabs
        value={mode}
        onChange={(m) => {
          setMode(m)
          if (target) setTarget(m)
        }}
        items={[
          { id: 'hue', label: t('mixer.hue') },
          { id: 'sat', label: t('mixer.sat') },
          { id: 'lum', label: t('mixer.lum') },
        ]}
      />
      {MIXER_COLORS.map((c) => (
        <ParamSlider key={`${mode}.${c}`} path={['mixer', mode, c]} label={t(`color.${c}` as TKey)} min={-100} max={100} bg={track(mode, c)} history={t('panel.colorMixer')} />
      ))}
    </div>
  )
}
