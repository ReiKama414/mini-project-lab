import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { fileToDataURL, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { copyText, downloadText, formatBytes } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'image-to-base64',
  title: '圖片 → Base64',
  description: '圖片轉 Data URL／純 Base64，本機預覽與下載',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev', 'image'],
}
const meta = getProject('image-to-base64') ?? fallback

type OutMode = 'dataurl' | 'base64'

export default function Page() {
  const [dataUrl, setDataUrl] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [mode, setMode] = useLocalStorage<OutMode>('lab:image-to-base64:mode', 'dataurl')

  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : ''
  const out = mode === 'dataurl' ? dataUrl : b64
  const preview = out.length > 600 ? `${out.slice(0, 600)}…` : out

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    setBusy(true)
    setError('')
    setCopied(null)
    try {
      const url = await fileToDataURL(file)
      setDataUrl(url)
      setInfo(`${file.name} · ${formatBytes(file.size)} · ${file.type || 'unknown'}`)
    } catch {
      setError('讀取失敗')
      setDataUrl('')
      setInfo('')
    } finally {
      setBusy(false)
    }
  }

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function clearAll() {
    setDataUrl('')
    setInfo('')
    setError('')
    setCopied(null)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!out} onClick={() => void copyVal(out, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!out}
            onClick={() => downloadText(mode === 'dataurl' ? 'image-data-url.txt' : 'image-base64.txt', out)}
            icon="download"
          >
            下載 txt
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              {info && <span className="tag">{info}</span>}
              {out && <span className="tag">{formatBytes(new Blob([out]).size)}</span>}
              {busy && <span className="tag">讀取中…</span>}
              {error && <span className="tag xc-tag-warn">失敗</span>}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">輸出格式</div>
            <div className="pw-chips">
              {(
                [
                  ['dataurl', 'Data URL'],
                  ['base64', '純 Base64'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${mode === id ? 'accent' : 'ghost'}`}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">圖片輸入</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!dataUrl && !error} onClick={clearAll}>
                清除
              </ActionButton>
            </div>
            {error && <p className="field-error">{error}</p>}
            {busy && !error && <p className="field-hint">讀取中…</p>}
            <FileDrop
              accept={IMAGE_ACCEPT}
              maxBytes={IMAGE_MAX_BYTES}
              disabled={busy}
              label="拖放圖片"
              hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)}`}
              onFiles={(files) => void onFile(files[0] ?? null)}
            />
            {dataUrl && (
              <img
                src={dataUrl}
                alt="預覽"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginTop: 8 }}
              />
            )}
            <div className="field-meta">
              <span>本機 FileReader</span>
              <span>Base64 約比原檔大 33%</span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">{mode === 'dataurl' ? 'Data URL' : '純 Base64'}</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!out}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(out, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!out}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText(mode === 'dataurl' ? 'image-data-url.txt' : 'image-base64.txt', out)}
                />
              </div>
            </div>
            {out ? (
              <pre className="xc-pre mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                {preview}
              </pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                選擇圖片後即時產生編碼
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">Data URL</span>
              <strong>格式為 data:&lt;mime&gt;;base64,&lt;payload&gt;，可直接用於 img src／CSS</strong>
            </li>
            <li>
              <span className="muted">體積</span>
              <strong>Base64 約比二進位大 33%；大圖可能拖慢頁面或剪貼簿</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機轉換，不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Base64 → 圖片、Data URI 產生器</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
