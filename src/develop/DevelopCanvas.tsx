import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { frameSize, resolveZoom } from '@/core/geometry/crop'
import { solveWB } from '@/core/color/whiteBalance'
import { hueToMixerColor, rgbToHsl } from '@/core/color/hsl'
import { applyPatch, createDefaultParams, type MixerColor } from '@/core/params/params'
import { EmptyState, ErrorState, LoadingState } from '@/design-system/states'
import { useT } from '@/i18n'
import { renderClient } from '@/render/client'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import { CropOverlay } from './CropOverlay'
import { DevelopToolbar } from './DevelopToolbar'
import './histogramStore'
import { useAnimatedView } from './useAnimatedView'
import { useViewInfo } from './viewStore'

const MAX_ZOOM = 16

export function DevelopCanvas({ loupe = false }: { loupe?: boolean }) {
  const t = useT()
  const id = usePhotos((s) => s.currentId)
  const photo = usePhotos((s) => (s.currentId ? s.photos[s.currentId] : undefined))
  const stored = usePhotos((s) => (s.currentId ? s.params[s.currentId] : undefined))
  const preview = useDevelop((s) => s.preview)
  const params = useMemo(() => (stored && preview ? applyPatch(stored, preview) : stored), [stored, preview])
  const setDims = usePhotos((s) => s.setDims)
  const dev = useDevelop()
  const { zoomMode, customZoom, pan, smooth, compare, clipping, cropEdit, picking, loadedId, mixerTarget } = dev

  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0, dpr: 1 })
  const [errorId, setErrorId] = useState<string | null>(null)
  const [space, setSpace] = useState(false)
  const [panning, setPanning] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const W = photo?.width ?? 0
  const H = photo?.height ?? 0
  const ready = !!id && loadedId === id && W > 0
  const failed = !!id && errorId === id
  const loading = !!photo && !ready && !failed

  // --- mount the (singleton) canvas -----------------------------------------------------------
  useLayoutEffect(() => {
    const el = boxRef.current!
    el.prepend(renderClient.canvas)
    return () => renderClient.canvas.remove()
  }, [])

  // --- viewport size --------------------------------------------------------------------------
  useLayoutEffect(() => {
    const el = boxRef.current!
    const measure = () => {
      const r = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      setBox({ w: r.width, h: r.height, dpr })
      renderClient.resize(Math.max(1, Math.round(r.width * dpr)), Math.max(1, Math.round(r.height * dpr)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // --- load the selected photo in the renderer ------------------------------------------------
  useEffect(() => {
    const d = useDevelop.getState()
    d.setReadout(null)
    if (d.cropEdit) d.exitCrop()
    useDevelop.setState({ zoomMode: 'fit', pan: { x: 0, y: 0 }, smooth: false, picking: false, mixerTarget: null })
    // already in the renderer (e.g. switching Library loupe ⇄ Develop): nothing to load
    if (id && d.loadedId === id && errorId !== id) return
    d.setLoadedId(null)
    if (!id) {
      renderClient.unload()
      return
    }
    let cancelled = false
    usePhotos.getState().getFile(id).then((file) => renderClient.load(id, file)).then(
      (dim) => {
        if (cancelled) return
        setDims(id, dim.width, dim.height)
        useDevelop.getState().setLoadedId(id)
      },
      () => {
        if (!cancelled) setErrorId(id)
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, setDims, reloadKey])

  // --- view -----------------------------------------------------------------------------------
  const crop = params?.crop
  const [fw, fh] = !crop ? [0, 0] : cropEdit ? frameSize(W, H, crop.angle) : [crop.w * W, crop.h * H]
  const vwDev = Math.round(box.w * box.dpr)
  const vhDev = Math.round(box.h * box.dpr)
  const fitZoom = resolveZoom('fit', 1, vwDev, vhDev, fw, fh)
  const targetZoom = resolveZoom(zoomMode, customZoom, vwDev, vhDev, fw, fh)
  const view = useAnimatedView(
    { zoom: targetZoom, x: zoomMode === 'custom' ? pan.x : 0, y: zoomMode === 'custom' ? pan.y : 0 },
    smooth,
    () => useDevelop.setState({ smooth: false }),
  )
  const viewRef = useRef({ view, vwDev, vhDev, fitZoom, ready, dpr: box.dpr })
  useEffect(() => {
    viewRef.current = { view, vwDev, vhDev, fitZoom, ready, dpr: box.dpr }
  })

  useEffect(() => {
    useViewInfo.setState({ zoom: view.zoom, x: view.x, y: view.y, vw: vwDev, vh: vhDev, fit: fitZoom })
  }, [view.zoom, view.x, view.y, vwDev, vhDev, fitZoom])

  // --- render ---------------------------------------------------------------------------------
  useEffect(() => {
    if (!ready || !params) return
    renderClient.render({
      params,
      // "before" = original tones, same geometry (crop / transform / lens)
      before: { ...createDefaultParams(), crop: params.crop, transform: params.transform, lens: params.lens },
      zoom: view.zoom,
      pan: [view.x, view.y],
      cropEdit,
      compare,
      clipping,
    })
  }, [ready, params, view.zoom, view.x, view.y, cropEdit, compare, clipping, vwDev, vhDev])

  // --- wheel zoom (needs a non-passive listener) ------------------------------------------------
  useEffect(() => {
    const el = boxRef.current!
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current
      if (!v.ready) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const vx = (e.clientX - r.left) * v.dpr
      const vy = (e.clientY - r.top) * v.dpr
      const z2 = Math.min(MAX_ZOOM, v.view.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
      if (z2 <= v.fitZoom * 1.001) return useDevelop.getState().setZoomMode('fit')
      const ox = (vx - v.vwDev / 2 - v.view.x) / v.view.zoom
      const oy = (vy - v.vhDev / 2 - v.view.y) / v.view.zoom
      useDevelop.getState().setView(z2, { x: vx - v.vwDev / 2 - ox * z2, y: vy - v.vhDev / 2 - oy * z2 })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // --- space to pan -----------------------------------------------------------------------------
  useEffect(() => {
    const typing = (e: Event) => ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes((e.target as HTMLElement).tagName)
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e)) {
        e.preventDefault()
        setSpace(true)
      }
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpace(false)
    const blur = () => setSpace(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // --- pointer: pan, readout, WB pick -----------------------------------------------------------
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const probing = useRef(false)
  const targetDrag = useRef<{ color: MixerColor; mode: 'hue' | 'sat' | 'lum'; y: number; base: number } | null>(null)
  const zoomedIn = view.zoom > fitZoom * 1.001

  const devPos = (e: React.PointerEvent | React.MouseEvent) => {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) * box.dpr, y: (e.clientY - r.top) * box.dpr }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready || picking) return
    if (mixerTarget && e.button === 0) {
      const p = devPos(e)
      const el = e.currentTarget
      const pid = e.pointerId
      const y0 = e.clientY
      const mode = mixerTarget
      el.setPointerCapture(pid)
      renderClient.probeRGB(Math.round(p.x), Math.round(p.y)).then((rgb) => {
        if (!rgb) return
        const [hue, sat] = rgbToHsl(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
        if (sat < 0.03) return
        const color = hueToMixerColor(hue)
        const s = usePhotos.getState()
        targetDrag.current = { color, mode, y: y0, base: s.params[s.currentId!]!.mixer[mode][color] }
      })
      return
    }
    if (e.button === 1 || (e.button === 0 && (space || zoomedIn))) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { x: e.clientX, y: e.clientY, px: view.x, py: view.y }
      setPanning(true)
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (targetDrag.current) {
      const d = targetDrag.current
      const v = Math.round(Math.min(100, Math.max(-100, d.base + (d.y - e.clientY) * 0.7)))
      usePhotos.getState().edit((p) => ({ ...p, mixer: { ...p.mixer, [d.mode]: { ...p.mixer[d.mode], [d.color]: v } } }))
      return
    }
    if (drag.current) {
      const d = drag.current
      useDevelop.getState().setView(view.zoom, { x: d.px + (e.clientX - d.x) * box.dpr, y: d.py + (e.clientY - d.y) * box.dpr })
      return
    }
    if (!ready || probing.current) return
    const p = devPos(e)
    probing.current = true
    renderClient
      .probeRGB(Math.round(p.x), Math.round(p.y))
      .then((rgb) => useDevelop.getState().setReadout(rgb))
      .catch(() => {})
      .finally(() => (probing.current = false))
  }
  const endDrag = () => {
    if (targetDrag.current) {
      targetDrag.current = null
      usePhotos.getState().commit(t('panel.colorMixer'))
    }
    drag.current = null
    setPanning(false)
  }
  const onClick = (e: React.MouseEvent) => {
    if (!picking || !ready) return
    const p = devPos(e)
    renderClient.probeWork(Math.round(p.x), Math.round(p.y)).then((rgb) => {
      if (!rgb) return
      const { temp, tint } = solveWB(...rgb)
      const s = usePhotos.getState()
      s.edit((pr) => ({ ...pr, basic: { ...pr.basic, temp, tint } }))
      s.commit(t('basic.temp'))
      useDevelop.getState().setPicking(false)
    })
  }

  const cursor = picking || mixerTarget ? 'crosshair' : panning ? 'grabbing' : space || zoomedIn ? 'grab' : 'default'

  // --- split divider ------------------------------------------------------------------------------
  const onDividerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDividerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return
    const r = boxRef.current!.getBoundingClientRect()
    useDevelop.getState().setSplitPos(compare.mode === 'lr' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height)
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={boxRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-bg-0"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => useDevelop.getState().setReadout(null)}
        onClick={onClick}
        onAuxClick={(e) => e.preventDefault()}
      >
        {!photo && <EmptyState title={t('empty.develop.title')} body={t('empty.develop.body')} />}
        {loading && (
          <div className="absolute inset-0 z-20 bg-bg-0/60">
            <LoadingState label={t('photo.loading')} />
          </div>
        )}
        {photo && failed && (
          <div className="absolute inset-0 z-20 bg-bg-0">
            <ErrorState error={new Error(`${t('photo.error')} — ${t('photo.errorHint')}`)} onRetry={() => {
                setErrorId(null)
                setReloadKey((k) => k + 1)
              }} />
          </div>
        )}

        {ready && cropEdit && crop && (
          <CropOverlay W={W} H={H} crop={crop} vw={box.w} vh={box.h} zCss={view.zoom / box.dpr} panX={view.x / box.dpr} panY={view.y / box.dpr} />
        )}

        {ready && (compare.mode === 'lr' || compare.mode === 'tb') && (
          <div
            role="separator"
            aria-label="Before/After"
            onPointerDown={onDividerDown}
            onPointerMove={onDividerMove}
            className="absolute z-10 flex items-center justify-center"
            style={
              compare.mode === 'lr'
                ? { left: `calc(${compare.pos * 100}% - 8px)`, top: 0, bottom: 0, width: 16, cursor: 'col-resize' }
                : { top: `calc(${compare.pos * 100}% - 8px)`, left: 0, right: 0, height: 16, cursor: 'row-resize' }
            }
          >
            <div className={compare.mode === 'lr' ? 'h-full w-px bg-white/80' : 'h-px w-full bg-white/80'} />
          </div>
        )}
        {ready && compare.mode !== 'off' && (
          <span className="pointer-events-none absolute top-2 left-2 z-10 rounded-[3px] bg-black/55 px-1.5 py-0.5 text-2xs text-white/90">
            {compare.mode === 'before' ? 'Before' : compare.mode === 'lr' ? 'Before | After' : 'Before / After'}
          </span>
        )}
      </div>
      {!loupe && <DevelopToolbar zoomPct={view.zoom * 100} />}
    </div>
  )
}
