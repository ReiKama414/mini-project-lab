import type { ReactNode, RefObject } from 'react'
import type { ProjectMeta } from '../projects/registry'
import { ProjectShell } from './ProjectShell'
import { FileDrop } from './FileDrop'
import { ActionButton } from './ActionButton'
import { formatBytes } from '../lib/utils'
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  aspectRatioLabel,
  megapixels,
} from '../lib/imageCanvas'

type InfoItem = { label: string; value: ReactNode }

type Props = {
  meta: ProjectMeta
  hint: string
  fileName: string
  fileSize: number
  width: number
  height: number
  /** Output dimensions when different from source (resize, border, crop…). */
  outWidth?: number
  outHeight?: number
  error?: string
  hasImage: boolean
  busy?: boolean
  onFile: (file: File | null) => void
  onDownload: () => void
  downloadLabel?: string
  controls: ReactNode
  preview: ReactNode
  infoExtra?: InfoItem[]
  statsExtra?: ReactNode
  shellActions?: ReactNode
}

export function ImageCanvasPreview({
  canvasRef,
  hasImage,
  empty = '上傳後預覽',
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  hasImage: boolean
  empty?: string
}) {
  if (!hasImage) return <div className="iw-empty">{empty}</div>
  return (
    <div className="iw-canvas-wrap">
      <canvas ref={canvasRef} className="iw-canvas" />
    </div>
  )
}

export function ImageUrlPreview({ url, alt = 'preview' }: { url: string; alt?: string }) {
  if (!url) return <div className="iw-empty">上傳後預覽</div>
  return (
    <div className="iw-canvas-wrap">
      <img src={url} alt={alt} className="iw-img" />
    </div>
  )
}

export function ImageWorkbench({
  meta,
  hint,
  fileName,
  fileSize,
  width,
  height,
  outWidth,
  outHeight,
  error,
  hasImage,
  busy,
  onFile,
  onDownload,
  downloadLabel = '下載 PNG',
  controls,
  preview,
  infoExtra,
  statsExtra,
  shellActions,
}: Props) {
  const ow = outWidth ?? width
  const oh = outHeight ?? height
  const mp = megapixels(width, height)
  const outMp = megapixels(ow, oh)

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row iw-shell-actions">
          {shellActions}
          <ActionButton className="btn sm accent" disabled={!hasImage || busy} onClick={onDownload}>
            {busy ? '處理中…' : downloadLabel}
          </ActionButton>
        </div>
      }
    >
      <div className="iw-calc">
        <div className="pw-stats">
          {hasImage ? (
            <>
              <span className="metric mono">
                {width}×{height}
              </span>
              <span className="tag">{formatBytes(fileSize)}</span>
              <span className="tag">{mp.toFixed(2)} MP</span>
              <span className="tag">{aspectRatioLabel(width, height)}</span>
              {(ow !== width || oh !== height) && (
                <span className="tag">
                  輸出 {ow}×{oh}
                </span>
              )}
              {statsExtra}
            </>
          ) : (
            <span className="metric muted">尚未上傳圖片</span>
          )}
        </div>

        <div className="iw-main">
          <section className="panel iw-settings">
            <h3 className="pw-panel-title">設定</h3>
            <FileDrop
              accept={IMAGE_ACCEPT}
              maxBytes={IMAGE_MAX_BYTES}
              disabled={busy}
              label="拖放圖片到此，或點擊選擇"
              hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)} · 僅本機處理`}
              onFiles={(files) => onFile(files[0] ?? null)}
            />
            {fileName && (
              <p className="muted iw-filename">
                {fileName}
                {width > 0 ? ` · ${width}×{height}` : ''}
                {fileSize ? ` · ${formatBytes(fileSize)}` : ''}
              </p>
            )}
            {error && <p className="field-error">{error}</p>}
            {busy && <p className="field-hint">處理中…</p>}
            <div className="iw-controls">{controls}</div>
            <ActionButton className="btn accent" disabled={!hasImage || busy} onClick={onDownload}>
              {busy ? '處理中…' : downloadLabel}
            </ActionButton>
          </section>

          <section className="panel iw-preview">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">預覽</h3>
              {hasImage && ow > 0 && (
                <span className="tag mono">
                  {ow}×{oh}
                </span>
              )}
            </div>
            {preview}
          </section>
        </div>

        <section className="panel iw-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">檔名</span>
              <strong className="mono">{fileName || '—'}</strong>
            </li>
            <li>
              <span className="muted">原始大小</span>
              <strong className="mono">{fileSize ? formatBytes(fileSize) : '—'}</strong>
            </li>
            <li>
              <span className="muted">原始尺寸</span>
              <strong className="mono">{width ? `${width} × ${height}` : '—'}</strong>
            </li>
            <li>
              <span className="muted">輸出尺寸</span>
              <strong className="mono">{ow ? `${ow} × ${oh}` : '—'}</strong>
            </li>
            <li>
              <span className="muted">長寬比</span>
              <strong className="mono">{aspectRatioLabel(width, height)}</strong>
            </li>
            <li>
              <span className="muted">像素（原始／輸出）</span>
              <strong className="mono">
                {mp ? `${mp.toFixed(2)} / ${outMp.toFixed(2)} MP` : '—'}
              </strong>
            </li>
            {infoExtra?.map((item) => (
              <li key={item.label}>
                <span className="muted">{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
          <p className="muted pw-hint">{hint}</p>
        </section>
      </div>
    </ProjectShell>
  )
}
