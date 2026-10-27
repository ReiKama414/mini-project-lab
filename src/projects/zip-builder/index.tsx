import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import { downloadBlob } from '../../lib/imageCanvas'
import { formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import { FtMetric, FtMetricGrid, FtSection, FtToolHero, FtToolRoot } from '../../components/FeatureToolUI'

const meta: ProjectMeta = getProject('zip-builder') ?? {
  slug: 'zip-builder',
  title: 'ZIP 打包',
  description: '本機將多檔打包成 ZIP',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['utility'],
}

const NAME_MAX = 80
const MAX_FILES = 100
const MAX_TOTAL = 100 * 1024 * 1024
const MAX_SINGLE = 40 * 1024 * 1024

function uniqueZipName(name: string, used: Set<string>) {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let n = 1
  let candidate = `${stem} (${n})${ext}`
  while (used.has(candidate)) {
    n++
    candidate = `${stem} (${n})${ext}`
  }
  used.add(candidate)
  return candidate
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [zipName, setZipName] = useState('archive.zip')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const nameOk = isNonEmpty(zipName) && /\.zip$/i.test(zipName.trim())
  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files])

  const mapped = useMemo(() => {
    const used = new Set<string>()
    return files.map((f) => ({ file: f, name: uniqueZipName(f.name, used) }))
  }, [files])

  const renamedCount = useMemo(
    () => mapped.filter((m, i) => m.name !== files[i]!.name).length,
    [mapped, files],
  )

  function onPick(list: File[] | FileList | null) {
    if (!list?.length) return
    const arr = Array.from(list)
    if (arr.length > MAX_FILES) {
      setError(`一次最多 ${MAX_FILES} 個檔案`)
      return
    }
    for (const f of arr) {
      if (f.size > MAX_SINGLE) {
        setError(`單一檔案過大：${f.name}（上限 ${formatBytes(MAX_SINGLE)}）`)
        return
      }
    }
    const total = arr.reduce((s, f) => s + f.size, 0)
    if (total > MAX_TOTAL) {
      setError(`總容量過大（上限 ${formatBytes(MAX_TOTAL)}）`)
      return
    }
    setFiles(arr)
    setError('')
    setInfo('')
    setProgress('')
  }

  async function build() {
    if (!files.length) {
      setError('請先選擇檔案')
      return
    }
    if (!nameOk) {
      setError('檔名需以 .zip 結尾')
      return
    }
    setBusy(true)
    setError('')
    setProgress('打包中…')
    try {
      const zip = new JSZip()
      for (const item of mapped) zip.file(item.name, item.file)
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (meta) => {
        setProgress(`壓縮 ${Math.round(meta.percent)}%`)
      })
      downloadBlob(blob, zipName.trim())
      setInfo(`已產生 ${formatBytes(blob.size)}，含 ${files.length} 個檔案${renamedCount ? `（${renamedCount} 個同名已自動改名）` : ''}`)
      setProgress('')
    } catch {
      setError('打包失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FeatureLayout
      meta={meta}
      footerHint="同名檔會自動加 (1)、(2)…"
      infoItems={[
        { label: '限制', value: `${MAX_FILES} 檔、單檔 ${formatBytes(MAX_SINGLE)}、合計 ${formatBytes(MAX_TOTAL)}` },
        { label: '打包', value: '本機 JSZip，不上傳' },
      ]}
      faq={[ftPrivacyLocal]}
      toolbar={
        <>
          <FileDrop
            multiple
            maxFiles={MAX_FILES}
            maxBytes={MAX_SINGLE}
            disabled={busy}
            label="拖放檔案到此，或點擊選擇（可多選）"
            hint={`上限 ${MAX_FILES} 檔 · 單檔 ${formatBytes(MAX_SINGLE)} · 合計 ${formatBytes(MAX_TOTAL)}`}
            onFiles={(picked) => onPick(picked)}
          />
          <label className="stack">
            <span className="label">ZIP 檔名</span>
            <input
              className={`field${!nameOk ? ' is-invalid' : ''}`}
              value={zipName}
              maxLength={NAME_MAX}
              disabled={busy}
              onChange={(e) => setZipName(limitText(e.target.value, NAME_MAX))}
            />
          </label>
        </>
      }
      actions={
        <ActionButton className="btn sm accent" disabled={busy || !files.length} onClick={() => void build()} icon="download">
          {busy ? '打包中…' : '下載 ZIP'}
        </ActionButton>
      }
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🗜️"
          title={files.length ? `${files.length} 個檔案待打包` : '選擇檔案開始打包'}
          subtitle={files.length ? `合計 ${formatBytes(totalSize)} · ${zipName.trim()}` : `本機 JSZip · 上限 ${formatBytes(MAX_TOTAL)}`}
          meta={info || progress || undefined}
          badge={busy ? <span className="tag">{progress || '打包中'}</span> : renamedCount ? <span className="tag">{renamedCount} 同名已改名</span> : null}
        />
        <FtMetricGrid>
          <FtMetric label="檔案數" value={files.length || '—'} />
          <FtMetric label="合計大小" value={files.length ? formatBytes(totalSize) : '—'} mono />
          <FtMetric label="ZIP 檔名" value={nameOk ? zipName.trim() : '需 .zip 結尾'} mono />
          <FtMetric label="壓縮" value="DEFLATE" />
        </FtMetricGrid>
        {error && <p className="field-error">{error}</p>}
        <FtSection title="檔案列表">
          <ul className="list">
            {mapped.map((m) => (
              <li key={m.name + m.file.size} className="list-item stack" style={{ gap: 2 }}>
                <div className="row" style={{ width: '100%' }}>
                  <span className="mono" style={{ flex: 1, wordBreak: 'break-all' }}>
                    {m.name}
                  </span>
                  <span className="tag">{formatBytes(m.file.size)}</span>
                </div>
                {m.name !== m.file.name && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    原名：{m.file.name}
                  </span>
                )}
              </li>
            ))}
            {!files.length && <p className="muted">尚未選擇檔案</p>}
          </ul>
        </FtSection>
        <ActionButton className="btn accent" disabled={busy || !files.length} onClick={() => void build()} icon="download">
          {busy ? progress || '打包中…' : '下載 ZIP'}
        </ActionButton>
      </FtToolRoot>
    </FeatureLayout>
  )
}
