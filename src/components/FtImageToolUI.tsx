import type { ReactNode, RefObject } from 'react'
import { formatBytes } from '../lib/utils'
import { aspectRatioLabel, megapixels, IMAGE_MAX_BYTES } from '../lib/imageCanvas'
import { FtMetric, FtMetricGrid, FtToolHero } from './FeatureToolUI'

export type FtImageMeta = {
  fileName: string
  fileSize: number
  width: number
  height: number
}

export function ftImageLocalFaq(extra?: string) {
  return {
    title: '本機限制',
    body:
      extra ??
      `Canvas 在瀏覽器本機處理，單檔 ≤ ${formatBytes(IMAGE_MAX_BYTES)}；超高解析度可能記憶體不足或預覽變慢。`,
  }
}

export function FtImageHero({
  meta,
  emoji = '🖼️',
  emptyTitle = '尚未上傳圖片',
  emptySubtitle = '於上方拖放或選擇檔案',
  subtitle,
  metaLine,
  badge,
}: {
  meta: FtImageMeta
  emoji?: ReactNode
  emptyTitle?: string
  emptySubtitle?: string
  subtitle?: ReactNode
  metaLine?: ReactNode
  badge?: ReactNode
}) {
  const ready = Boolean(meta.fileName && meta.width > 0)
  if (!ready) {
    return <FtToolHero emoji={emoji} title={emptyTitle} subtitle={emptySubtitle} />
  }
  const sub =
    subtitle ??
    `${meta.width} × ${meta.height} · ${formatBytes(meta.fileSize)} · ${aspectRatioLabel(meta.width, meta.height)}`
  return (
    <FtToolHero
      emoji={emoji}
      title={<span className="mono" style={{ fontSize: '1.05rem' }}>{meta.fileName}</span>}
      subtitle={sub}
      meta={metaLine}
      badge={badge}
    />
  )
}

export function FtImageMetrics({
  meta,
  extra,
}: {
  meta: FtImageMeta
  extra?: { label: string; value: ReactNode; mono?: boolean }[]
}) {
  const ready = meta.width > 0 && meta.fileSize > 0
  const items = ready
    ? [
        { label: '檔案大小', value: formatBytes(meta.fileSize), mono: true },
        { label: '寬 × 高', value: `${meta.width} × ${meta.height}`, mono: true },
        { label: '像素', value: `${megapixels(meta.width, meta.height).toFixed(2)} MP`, mono: true },
        { label: '長寬比', value: aspectRatioLabel(meta.width, meta.height), mono: true },
        ...(extra ?? []),
      ]
    : [
        { label: '檔案大小', value: '—' },
        { label: '寬 × 高', value: '—' },
        { label: '像素', value: '—' },
        { label: '長寬比', value: '—' },
      ]
  return (
    <FtMetricGrid>
      {items.map((m) => (
        <FtMetric key={m.label} label={m.label} value={m.value} mono={m.mono} />
      ))}
    </FtMetricGrid>
  )
}

export function FtAsidePreview({ title = '預覽', tag, children }: { title?: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <div className="stack ft-ui-aside">
      <div className="pw-panel-head">
        <h3 className="pw-panel-title">{title}</h3>
        {tag}
      </div>
      {children}
    </div>
  )
}

export function FtCanvasAside({
  canvasRef,
  hasImage,
  empty = '上傳後即時預覽',
  checkerboard,
  canvasClassName,
  canvasStyle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  hasImage: boolean
  empty?: string
  checkerboard?: boolean
  canvasClassName?: string
  canvasStyle?: React.CSSProperties
  onPointerDown?: React.PointerEventHandler<HTMLCanvasElement>
  onPointerMove?: React.PointerEventHandler<HTMLCanvasElement>
  onPointerUp?: React.PointerEventHandler<HTMLCanvasElement>
  onPointerCancel?: React.PointerEventHandler<HTMLCanvasElement>
}) {
  if (!hasImage) return <div className="iw-empty">{empty}</div>
  return (
    <div className={`iw-canvas-wrap${checkerboard ? ' ft-ui-checker' : ''}`}>
      <canvas
        ref={canvasRef}
        className={canvasClassName ?? 'iw-canvas'}
        style={canvasStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    </div>
  )
}

export function FtImgAside({ src, alt = 'preview', empty = '上傳後即時預覽' }: { src: string; alt?: string; empty?: string }) {
  if (!src) return <div className="iw-empty">{empty}</div>
  return (
    <div className="iw-canvas-wrap ft-ui-checker">
      <img src={src} alt={alt} className="iw-img" />
    </div>
  )
}
