import { getProject, type ProjectMeta } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'
import { useMemo, useState } from 'react'
import { FtSection, FtToolRoot } from '../../components/FeatureToolUI'
import {
  FtAsidePreview,
  FtImageHero,
  FtImageMetrics,
  FtImgAside,
  ftImageLocalFaq,
} from '../../components/FtImageToolUI'
import { formatBytes, copyText } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import exifr from 'exifr'

const fallback: ProjectMeta = {
  slug: 'exif-cleaner',
  title: 'EXIF 清除器',
  description: '檢視並清除圖片 EXIF 後重新匯出',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility', 'security'],
}
const meta = getProject('exif-cleaner') ?? fallback

function pickMime(file: File): { mime: 'image/png' | 'image/jpeg' | 'image/webp'; ext: string; quality?: number } {
  const t = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (t === 'image/png' || name.endsWith('.png')) return { mime: 'image/png', ext: 'png' }
  if (t === 'image/webp' || name.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp', quality: 0.92 }
  return { mime: 'image/jpeg', ext: 'jpg', quality: 0.92 }
}

export default function Page() {
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [exif, setExif] = useState<Record<string, unknown> | null>(null)
  const [cleanBlob, setCleanBlob] = useState<Blob | null>(null)
  const [outExt, setOutExt] = useState('jpg')
  const [origSize, setOrigSize] = useState(0)
  const [imgW, setImgW] = useState(0)
  const [imgH, setImgH] = useState(0)
  const [note, setNote] = useState('')

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    setBusy(true)
    setError('')
    setNote('')
    try {
      setOrigSize(file.size)
      setFileName(file.name)
      const data = await exifr.parse(file).catch(() => null)
      setExif(data && typeof data === 'object' ? (data as Record<string, unknown>) : null)
      const img = await loadImageFromFile(file)
      const { canvas } = canvasFromImage(img)
      setImgW(canvas.width)
      setImgH(canvas.height)
      const fmt = pickMime(file)
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, fmt.mime, fmt.quality),
      )
      if (!blob) throw new Error('匯出失敗')
      setCleanBlob(blob)
      setOutExt(fmt.ext)
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      if (fmt.mime === 'image/png') setNote('以 PNG 重繪匯出，可保留透明並去除 EXIF')
      else if (fmt.mime === 'image/webp') setNote('以 WebP 重繪匯出並去除 EXIF')
      else setNote('以 JPEG 重繪匯出並去除 EXIF（有損壓縮）')
    } catch {
      setError('無法處理圖片')
      setCleanBlob(null)
    } finally {
      setBusy(false)
    }
  }

  const entries = exif ? Object.entries(exif).slice(0, 40) : []
  const outName = `${fileName.replace(/\.[^.]+$/, '') || 'image'}-no-exif.${outExt}`

  const imageMeta = useMemo(
    () => ({ fileName, fileSize: origSize, width: imgW, height: imgH }),
    [fileName, origSize, imgW, imgH],
  )

  return (
    <FeatureLayout
      meta={meta}
      variant="stacked"
      toolbar={
        <FileDrop
          accept={IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          disabled={busy}
          label="拖放圖片到此，或點擊選擇"
          hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)} · 僅本機處理`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
      }
      actions={
        <ActionButton
          className="btn sm accent"
          disabled={!cleanBlob || busy}
          onClick={() => cleanBlob && downloadBlob(cleanBlob, outName)}
          icon="download"
        >
          下載已清除
        </ActionButton>
      }
      infoItems={[
        { label: '單檔上限', value: formatBytes(IMAGE_MAX_BYTES) },
        { label: '方式', value: 'Canvas 重繪去除中繼資料' },
        { label: '輸出', value: 'PNG 保留透明；JPEG／WebP 依原格式' },
      ]}
      faq={[
        ftPrivacyLocal,
        ftImageLocalFaq(`EXIF 解析與重繪在瀏覽器完成；部分 RAW 或超大圖可能無法讀取。`),
      ]}
      aside={
        <FtAsidePreview
          title="清除後預覽"
          tag={cleanBlob ? <span className="tag">{formatBytes(cleanBlob.size)}</span> : null}
        >
          <FtImgAside src={preview} empty="上傳後顯示重繪結果" />
        </FtAsidePreview>
      }
    >
      <FtToolRoot>
        <FtImageHero
          emoji="🧹"
          meta={imageMeta}
          metaLine={note || (entries.length ? `偵測到 ${entries.length} 項 EXIF` : fileName ? '未偵測到 EXIF' : undefined)}
          badge={cleanBlob ? <span className="tag">.{outExt}</span> : busy ? <span className="tag">處理中</span> : null}
        />
        <FtImageMetrics
          meta={imageMeta}
          extra={[
            {
              label: '輸出大小',
              value: cleanBlob ? formatBytes(cleanBlob.size) : '—',
              mono: true,
            },
            { label: 'EXIF 欄位', value: entries.length || '—' },
          ]}
        />
        {busy && <p className="field-hint">處理中…</p>}
        {error && <p className="field-error">{error}</p>}

        <FtSection title="偵測到的 EXIF" hint="重繪匯出後中繼資料不會寫入新檔">
          {entries.length ? (
            <div className="stack" style={{ maxHeight: 320, overflow: 'auto', fontSize: 13 }}>
              {entries.map(([k, v]) => (
                <div key={k} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span className="muted">{k}</span>
                  <span className="mono" style={{ textAlign: 'right', wordBreak: 'break-all' }}>
                    {String(v)}
                  </span>
                </div>
              ))}
              <ActionButton className="btn sm ghost" onClick={() => void copyText(JSON.stringify(exif, null, 2))} icon="copy">
                複製 JSON
              </ActionButton>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>{fileName ? '未偵測到 EXIF 或已為乾淨圖' : '上傳後顯示'}</p>
          )}
        </FtSection>

        <ActionButton className="btn accent" disabled={!cleanBlob || busy} onClick={() => cleanBlob && downloadBlob(cleanBlob, outName)} icon="download">
          下載無 EXIF（.{outExt}）
        </ActionButton>
      </FtToolRoot>
    </FeatureLayout>
  )
}
