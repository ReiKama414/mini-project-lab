import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, copyText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('qr-generator')!

const TEXT_MAX = 2048
const FILTER_MAX = 80
const HEX_MAX = 7
const SIZE_MIN = 160
const SIZE_MAX = 480
const HISTORY_CAP = 24
const LOGO_MAX_PX = 192
const LOGO_FILE_MAX = 1_200_000

type EcLevel = 'L' | 'M' | 'Q' | 'H'
type StyleId =
  | 'classic'
  | 'cute'
  | 'cyber'
  | 'pixel'
  | 'cool'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'neon'
  | 'gold'
  | 'candy'
  | 'ink'
  | 'retro'
  | 'frost'
  | 'comic'
  | 'midnight'
  | 'matcha'
  | 'mono'
type Kind = 'url' | 'wifi' | 'tel' | 'mailto' | 'sms' | 'geo' | 'text'

type HistoryItem = {
  id: string
  text: string
  at: number
  fg: string
  bg: string
  size: number
  level: EcLevel
  style: StyleId
  cute: number
  hasLogo: boolean
}

const PRESETS = [
  { label: '範例網址', text: 'https://example.com' },
  { label: 'Wi‑Fi（示範）', text: 'WIFI:T:WPA;S:MyNetwork;P:password123;;' },
  { label: '電話', text: 'tel:+886912345678' },
  { label: 'Email', text: 'mailto:hello@example.com?subject=Hello' },
  { label: '簡訊', text: 'sms:+886912345678?body=你好' },
  { label: '座標', text: 'geo:25.033964,121.564468' },
  { label: '純文字', text: '歡迎使用 QR 產生器' },
]

const STYLE_PACKS: {
  id: StyleId
  label: string
  hint: string
  fg: string
  bg: string
}[] = [
  { id: 'classic', label: '經典', hint: '高對比、最穩', fg: '#1a1a1a', bg: '#ffffff' },
  { id: 'cute', label: '可愛', hint: '粉嫩圓角，可調可愛度', fg: '#c45c7a', bg: '#fff4f7' },
  { id: 'cyber', label: '賽博龐克', hint: '霓虹青紫掃描線', fg: '#39ffd0', bg: '#070612' },
  { id: 'pixel', label: '像素', hint: '塊狀無抗鋸齒', fg: '#2b2118', bg: '#f4e7c8' },
  { id: 'cool', label: '酷炫', hint: '靛色金屬感', fg: '#dbeafe', bg: '#0b1220' },
  { id: 'sunset', label: '日落', hint: '珊瑚暖橘', fg: '#c2410c', bg: '#fff7ed' },
  { id: 'ocean', label: '海洋', hint: '深海藍綠', fg: '#0e7490', bg: '#ecfeff' },
  { id: 'forest', label: '森林', hint: '苔蘚自然感', fg: '#166534', bg: '#f0fdf4' },
  { id: 'neon', label: '霓虹', hint: '熱粉暗底', fg: '#ff2bd6', bg: '#09000f' },
  { id: 'gold', label: '金箔', hint: '奢華金屬', fg: '#f5d78e', bg: '#1a1205' },
  { id: 'candy', label: '糖果', hint: '亮紫粉甜感', fg: '#7c3aed', bg: '#fdf2ff' },
  { id: 'ink', label: '水墨', hint: '墨色宣紙', fg: '#111827', bg: '#f5f0e6' },
  { id: 'retro', label: '復古', hint: '70 年代暖調', fg: '#7c2d12', bg: '#fef3c7' },
  { id: 'frost', label: '霜凍', hint: '冰晶藍白', fg: '#0369a1', bg: '#f0f9ff' },
  { id: 'comic', label: '漫畫', hint: '粗框波點', fg: '#111111', bg: '#fffbeb' },
  { id: 'midnight', label: '午夜', hint: '深紫星空', fg: '#c4b5fd', bg: '#12081f' },
  { id: 'matcha', label: '抹茶', hint: '柔和茶綠', fg: '#3f6212', bg: '#f7fee7' },
  { id: 'mono', label: '單色', hint: '極簡灰階', fg: '#111827', bg: '#f3f4f6' },
]

function frameRadius(style: StyleId, cute: number) {
  if (style === 'cute') return `${10 + cute / 6}px`
  if (style === 'pixel' || style === 'comic') return '2px'
  if (style === 'ink' || style === 'mono') return '6px'
  if (style === 'gold' || style === 'midnight') return '18px'
  return '14px'
}

const KIND_LABEL: Record<Kind, string> = {
  url: '網址',
  wifi: 'Wi‑Fi 設定',
  tel: '電話',
  mailto: '電子郵件',
  sms: '簡訊',
  geo: '地理座標',
  text: '純文字',
}

function detectKind(raw: string): Kind {
  const t = raw.trim()
  if (/^WIFI:/i.test(t)) return 'wifi'
  if (/^tel:/i.test(t)) return 'tel'
  if (/^mailto:/i.test(t)) return 'mailto'
  if (/^sms:/i.test(t)) return 'sms'
  if (/^geo:/i.test(t)) return 'geo'
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return 'url'
  return 'text'
}

function mixHex(a: string, b: string, t: number) {
  const parse = (h: string) => {
    const s = h.replace('#', '')
    if (s.length !== 6) return null
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] as const
  }
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return a
  const ch = (x: number) => Math.round(x).toString(16).padStart(2, '0')
  return `#${ch(pa[0] + (pb[0] - pa[0]) * t)}${ch(pa[1] + (pb[1] - pa[1]) * t)}${ch(pa[2] + (pb[2] - pa[2]) * t)}`
}

function estimateVersion(bytes: number, level: EcLevel) {
  // Rough capacity table for alphanumeric-ish payloads (bytes, conservative)
  const table: Record<EcLevel, number[]> = {
    L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
    M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
    Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
    H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
  }
  const caps = table[level]
  const idx = caps.findIndex((n) => bytes <= n)
  return idx === -1 ? `10+（資料偏多）` : String(idx + 1)
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(LOGO_MAX_PX / img.width, LOGO_MAX_PX / img.height, 1)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

export default function Page() {
  const [text, setText] = useLocalStorage('lab:qr-generator:text', 'https://example.com')
  const [size, setSize] = useLocalStorage('lab:qr-generator:size', 280)
  const [fg, setFg] = useLocalStorage('lab:qr-generator:fg', '#1a1a1a')
  const [bg, setBg] = useLocalStorage('lab:qr-generator:bg', '#ffffff')
  const [level, setLevel] = useLocalStorage<EcLevel>('lab:qr-generator:level', 'M')
  const [style, setStyle] = useLocalStorage<StyleId>('lab:qr-generator:style', 'classic')
  const [cute, setCute] = useLocalStorage('lab:qr-generator:cute', 35)
  const [margin, setMargin] = useLocalStorage('lab:qr-generator:margin', true)
  const [logo, setLogo] = useLocalStorage('lab:qr-generator:logo', '')
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:qr-generator:history-v2', [])
  const [filter, setFilter] = useState('')
  const [note, setNote] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const value = text.trim()
  const canAct = isNonEmpty(text) && charCount(text) <= TEXT_MAX
  const sizeSafe = clamp(size, SIZE_MIN, SIZE_MAX)
  const cuteSafe = clamp(cute, 0, 100)
  const kind = detectKind(value)
  const pack = STYLE_PACKS.find((s) => s.id === style) ?? STYLE_PACKS[0]!
  const effectiveLevel: EcLevel = logo ? 'H' : level

  const displayFg = style === 'cute' ? mixHex(pack.fg, '#ff7aa8', cuteSafe / 180) : fg
  const displayBg = style === 'cute' ? mixHex(pack.bg, '#ffe8f0', cuteSafe / 200) : bg

  const stats = useMemo(() => {
    const bytes = new TextEncoder().encode(value).length
    return {
      chars: value.length,
      bytes,
      version: estimateVersion(bytes, effectiveLevel),
      historyCount: history.length,
    }
  }, [value, effectiveLevel, history.length])

  const filteredHistory = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return history
    return history.filter((h) => h.text.toLowerCase().includes(q) || h.style.includes(q))
  }, [history, filter])

  const logoSize = Math.round(sizeSafe * (0.18 + (style === 'cute' ? cuteSafe / 800 : 0)))

  function applyStyle(id: StyleId) {
    const next = STYLE_PACKS.find((s) => s.id === id)!
    setStyle(id)
    setFg(next.fg)
    setBg(next.bg)
    if (id !== 'classic' && logo) setLevel('H')
  }

  function saveHistory() {
    if (!canAct) return
    setHistory((h) =>
      [
        {
          id: uid('qr'),
          text: value,
          at: Date.now(),
          fg: displayFg,
          bg: displayBg,
          size: sizeSafe,
          level: effectiveLevel,
          style,
          cute: cuteSafe,
          hasLogo: Boolean(logo),
        },
        ...h.filter((x) => x.text !== value),
      ].slice(0, HISTORY_CAP),
    )
  }

  function applyHistory(item: HistoryItem) {
    setText(item.text)
    setFg(item.fg)
    setBg(item.bg)
    setSize(item.size)
    setLevel(item.level)
    setStyle(item.style)
    setCute(item.cute)
    setNote('')
  }

  async function downloadSvg() {
    const svg = wrapRef.current?.querySelector('svg')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    downloadBlob('qrcode.svg', new Blob([xml], { type: 'image/svg+xml' }))
    saveHistory()
  }

  async function downloadPng() {
    const svg = wrapRef.current?.querySelector('svg')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = sizeSafe
      canvas.height = sizeSafe
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = style !== 'pixel'
      ctx.fillStyle = displayBg
      ctx.fillRect(0, 0, sizeSafe, sizeSafe)
      ctx.drawImage(img, 0, 0, sizeSafe, sizeSafe)
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob('qrcode.png', blob)
          saveHistory()
        }
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = url
  }

  async function onLogoFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNote('請選擇圖片檔')
      return
    }
    if (file.size > LOGO_FILE_MAX) {
      setNote('圖片太大，請小於 1.2MB')
      return
    }
    try {
      const data = await fileToLogoDataUrl(file)
      setLogo(data)
      setLevel('H')
      setNote('已插入中心圖，容錯已改為 H')
    } catch {
      setNote('圖片讀取失敗')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row qr-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!canAct} onClick={saveHistory}>
            存入歷史
          </ActionButton>
          <ActionButton className="btn sm teal" disabled={!canAct} onClick={() => void downloadSvg()}>
            SVG
          </ActionButton>
          <ActionButton className="btn sm accent" disabled={!canAct} onClick={() => void downloadPng()}>
            PNG
          </ActionButton>
        </div>
      }
    >
      <div className="qr-calc">
        <div className="pw-stats">
          <span className="metric">{KIND_LABEL[kind]}</span>
          <span className="tag">字元 {stats.chars}</span>
          <span className="tag">約 {stats.bytes} bytes</span>
          <span className="tag">容錯 {effectiveLevel}</span>
          <span className="tag">約 Version {stats.version}</span>
        </div>

        <div className="qr-main">
          <section className="panel qr-settings">
            <h3 className="pw-panel-title">內容與風格</h3>

            <div className="pw-block">
              <div className="label">內容預設</div>
              <div className="pw-chips">
                {PRESETS.map((p) => (
                  <button key={p.label} type="button" className="btn sm ghost" onClick={() => setText(p.text)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="stack">
              <span className="label">內容（文字或 URL）</span>
              <textarea
                className={`field${!canAct && text ? ' is-invalid' : ''}`}
                rows={4}
                value={text}
                maxLength={TEXT_MAX}
                onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))}
                placeholder="https://…"
              />
              <div className="field-meta">
                <span>
                  {charCount(text)} / {TEXT_MAX}
                </span>
              </div>
            </label>

            <div className="pw-block">
              <div className="label">視覺風格</div>
              <div className="pw-chips">
                {STYLE_PACKS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`btn sm ${style === s.id ? 'accent' : 'ghost'}`}
                    title={s.hint}
                    onClick={() => applyStyle(s.id)}
                  >
                    <span
                      className="qr-style-dot"
                      style={{ background: `linear-gradient(135deg, ${s.fg} 49%, ${s.bg} 51%)` }}
                      aria-hidden
                    />
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="field-hint">{pack.hint}</p>
            </div>

            {style === 'cute' && (
              <label className="stack">
                <span className="label">可愛程度：{cuteSafe}</span>
                <input
                  className="field"
                  type="range"
                  min={0}
                  max={100}
                  value={cuteSafe}
                  onChange={(e) => setCute(clamp(parseNumber(e.target.value, 0), 0, 100))}
                />
              </label>
            )}

            <label className="stack">
              <span className="label">尺寸：{sizeSafe}px</span>
              <input
                className="field"
                type="range"
                min={SIZE_MIN}
                max={SIZE_MAX}
                step={8}
                value={sizeSafe}
                onChange={(e) => setSize(clamp(parseNumber(e.target.value, SIZE_MIN), SIZE_MIN, SIZE_MAX))}
              />
            </label>

            <label className="stack">
              <span className="label">容錯等級{logo ? '（已因圖片改為 H）' : ''}</span>
              <select
                className="field"
                value={effectiveLevel}
                disabled={Boolean(logo)}
                onChange={(e) => setLevel(e.target.value as EcLevel)}
              >
                <option value="L">L · 約 7%</option>
                <option value="M">M · 約 15%</option>
                <option value="Q">Q · 約 25%</option>
                <option value="H">H · 約 30%</option>
              </select>
            </label>

            <label className="pw-check">
              <input type="checkbox" checked={margin} onChange={() => setMargin(!margin)} />
              <span>保留靜默區（較好掃）</span>
            </label>

            <div className="qr-fields-2">
              <label className="stack">
                <span className="label">前景色</span>
                <div className="row">
                  <input
                    type="color"
                    value={displayFg}
                    onChange={(e) => setFg(e.target.value)}
                    style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    className="field mono"
                    style={{ flex: 1 }}
                    value={displayFg}
                    maxLength={HEX_MAX}
                    onChange={(e) => setFg(limitText(e.target.value, HEX_MAX))}
                  />
                </div>
              </label>
              <label className="stack">
                <span className="label">背景色</span>
                <div className="row">
                  <input
                    type="color"
                    value={displayBg}
                    onChange={(e) => setBg(e.target.value)}
                    style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    className="field mono"
                    style={{ flex: 1 }}
                    value={displayBg}
                    maxLength={HEX_MAX}
                    onChange={(e) => setBg(limitText(e.target.value, HEX_MAX))}
                  />
                </div>
              </label>
            </div>

            <div className="pw-block">
              <div className="label">中心圖片（個性化）</div>
              <div className="pw-chips">
                <ActionButton className="btn sm ghost" onClick={() => fileRef.current?.click()}>
                  插入圖片
                </ActionButton>
                <ActionButton className="btn sm ghost" disabled={!logo} onClick={() => setLogo('')}>
                  移除圖片
                </ActionButton>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  void onLogoFile(f)
                }}
              />
              {logo && (
                <div className="qr-logo-preview">
                  <img src={logo} alt="中心圖預覽" />
                  <span className="muted">會挖空中心模組，建議對比夠高、圖不要太大</span>
                </div>
              )}
            </div>
          </section>

          <aside className="qr-side">
            <section className="panel qr-preview">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">預覽 · {pack.label}</h3>
                <span className="tag">{sizeSafe}px</span>
              </div>

              {value ? (
                <div className={`qr-stage qr-style-${style}`} data-cute={cuteSafe}>
                  <div
                    ref={wrapRef}
                    className="qr-frame"
                    style={{
                      background: displayBg,
                      ['--qr-radius' as string]: frameRadius(style, cuteSafe),
                      ['--qr-fg' as string]: displayFg,
                    }}
                  >
                    <QRCodeSVG
                      value={value}
                      size={sizeSafe}
                      fgColor={displayFg}
                      bgColor={displayBg}
                      level={effectiveLevel}
                      marginSize={margin ? 2 : 0}
                      imageSettings={
                        logo
                          ? {
                              src: logo,
                              height: logoSize,
                              width: logoSize,
                              excavate: true,
                            }
                          : undefined
                      }
                    />
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  請輸入內容以產生 QR Code
                </p>
              )}

              <div className="pw-actions">
                <ActionButton className="btn accent pw-gen-btn" disabled={!canAct} onClick={() => void downloadPng()}>
                  下載 PNG
                </ActionButton>
                <ActionButton className="btn ghost" disabled={!canAct} onClick={() => void downloadSvg()}>
                  下載 SVG
                </ActionButton>
              </div>
              {note && <p className="field-hint">{note}</p>}
            </section>

            <section className="panel qr-info">
              <h3 className="pw-panel-title">更多資訊</h3>
              <ul className="pw-info-list">
                <li>
                  <span className="muted">內容類型</span>
                  <strong>{KIND_LABEL[kind]}</strong>
                </li>
                <li>
                  <span className="muted">資料量</span>
                  <strong>
                    {stats.chars} 字 · {stats.bytes} bytes
                  </strong>
                </li>
                <li>
                  <span className="muted">估計 Version</span>
                  <strong>{stats.version}</strong>
                </li>
                <li>
                  <span className="muted">容錯</span>
                  <strong>{effectiveLevel}</strong>
                </li>
                <li>
                  <span className="muted">中心圖</span>
                  <strong>{logo ? '有（H 容錯）' : '無'}</strong>
                </li>
              </ul>
              <p className="muted pw-hint">
                風格與可愛程度只改配色與外框；真正可掃的是模組對比。插入圖片請維持 H 容錯，並實機掃描確認。
              </p>
            </section>
          </aside>
        </div>

        <section className="panel qr-history">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">歷史</h3>
            <ActionButton
              className="btn sm ghost"
              disabled={!history.length}
              onClick={() => {
                if (confirm('確定清空全部歷史？')) setHistory([])
              }}
            >
              清空
            </ActionButton>
          </div>
          <input
            className="field"
            placeholder="篩選內容／風格…"
            value={filter}
            maxLength={FILTER_MAX}
            onChange={(e) => setFilter(limitText(e.target.value, FILTER_MAX))}
          />
          {!filteredHistory.length && (
            <p className="muted" style={{ margin: 0 }}>
              下載或按「存入歷史」後會出現在此（本機）
            </p>
          )}
          <ul className="qr-history-list">
            {filteredHistory.map((h) => (
              <li key={h.id} className="qr-history-card">
                <div className="mono qr-history-text">{h.text}</div>
                <div className="pw-history-meta">
                  <span className="tag">{STYLE_PACKS.find((s) => s.id === h.style)?.label ?? h.style}</span>
                  <span className="tag">{h.size}px</span>
                  <span className="tag">{h.level}</span>
                  {h.hasLogo && <span className="tag">有圖</span>}
                </div>
                <div className="muted pw-history-time">{new Date(h.at).toLocaleString('zh-TW')}</div>
                <div className="pw-history-actions">
                  <ActionButton className="btn sm ghost" onClick={() => applyHistory(h)} icon="check">
                    套用
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyText(h.text)}
                    icon="copy"
                    iconOnly
                    tooltip="複製"
                  />
                  <DeleteButton onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))} label="刪除" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
