import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('tip-calculator')!

const BILL_MAX = 1_000_000
const PCT_MAX = 100
const PEOPLE_MIN = 1
const PEOPLE_MAX = 50
const HISTORY_CAP = 30

type TipBase = 'pre-tax' | 'post-tax'

type HistoryItem = {
  id: string
  at: number
  bill: number
  tip: number
  tax: number
  people: number
  roundUp: boolean
  tipBase?: TipBase
  tipAmt: number
  taxAmt: number
  total: number
  perPerson: number
}

/** Compact share payload (v1) */
type SharePayload = {
  v: 1
  b: number
  t: number
  x: number
  p: number
  r: 0 | 1
  m: 0 | 1 // tipBase: 0 post-tax, 1 pre-tax
  c: number // checksum
}

const TIP_PRESETS = [0, 5, 10, 12, 15, 18, 20, 25]
const PEOPLE_PRESETS = [1, 2, 3, 4, 5, 6, 8]
const COMPARE_TIPS = [10, 12, 15, 18, 20, 25]

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function checksum(b: number, t: number, x: number, p: number, r: number, m: number) {
  // Lightweight integrity check (not cryptographic) — discourages casual URL edits
  const s = `${b}|${t}|${x}|${p}|${r}|${m}|tip-v1`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function toBase64Url(json: string) {
  const bin = new TextEncoder().encode(json)
  let s = ''
  bin.forEach((c) => {
    s += String.fromCharCode(c)
  })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(raw: string) {
  const pad = raw.length % 4 === 0 ? '' : '='.repeat(4 - (raw.length % 4))
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeShare(state: {
  bill: number
  tip: number
  tax: number
  people: number
  roundUp: boolean
  tipBase: TipBase
}) {
  const m = state.tipBase === 'pre-tax' ? 1 : 0
  const r = state.roundUp ? 1 : 0
  const payload: SharePayload = {
    v: 1,
    b: state.bill,
    t: state.tip,
    x: state.tax,
    p: state.people,
    r,
    m,
    c: checksum(state.bill, state.tip, state.tax, state.people, r, m),
  }
  return toBase64Url(JSON.stringify(payload))
}

function decodeShare(token: string): Omit<SharePayload, 'v' | 'c'> | null {
  try {
    const data = JSON.parse(fromBase64Url(token)) as Partial<SharePayload>
    if (data.v !== 1) return null
    if (
      typeof data.b !== 'number' ||
      typeof data.t !== 'number' ||
      typeof data.x !== 'number' ||
      typeof data.p !== 'number' ||
      (data.r !== 0 && data.r !== 1) ||
      (data.m !== 0 && data.m !== 1) ||
      typeof data.c !== 'number'
    ) {
      return null
    }
    if (data.c !== checksum(data.b, data.t, data.x, data.p, data.r, data.m)) return null
    return { b: data.b, t: data.t, x: data.x, p: data.p, r: data.r, m: data.m }
  } catch {
    return null
  }
}

export default function Page() {
  const [bill, setBill] = useLocalStorage('lab:tip-calculator:bill', 1000)
  const [tip, setTip] = useLocalStorage('lab:tip-calculator:tip', 10)
  const [tax, setTax] = useLocalStorage('lab:tip-calculator:tax', 0)
  const [people, setPeople] = useLocalStorage('lab:tip-calculator:people', 2)
  const [roundUp, setRoundUp] = useLocalStorage('lab:tip-calculator:roundUp', false)
  const [tipBase, setTipBase] = useLocalStorage<TipBase>('lab:tip-calculator:tipBase', 'post-tax')
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:tip-calculator:history', [])
  const [error, setError] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [copied, setCopied] = useState<'summary' | 'link' | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('s')
    if (!token) return
    const decoded = decodeShare(token)
    if (!decoded) {
      setShareNote('分享連結無效或已被竄改，已略過')
      return
    }
    setBill(clamp(decoded.b, 0, BILL_MAX))
    setTip(clamp(decoded.t, 0, PCT_MAX))
    setTax(clamp(decoded.x, 0, PCT_MAX))
    setPeople(clamp(decoded.p, PEOPLE_MIN, PEOPLE_MAX))
    setRoundUp(decoded.r === 1)
    setTipBase(decoded.m === 1 ? 'pre-tax' : 'post-tax')
    setShareNote('已從分享連結載入設定')
    setError('')
    // 僅首次載入解析 URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const calc = useMemo(() => {
    const taxAmt = (bill * tax) / 100
    const tipOn = tipBase === 'pre-tax' ? bill : bill + taxAmt
    const tipAmt = (tipOn * tip) / 100
    let total = bill + taxAmt + tipAmt
    const beforeRound = total
    if (roundUp) total = Math.ceil(total)
    const roundDelta = total - beforeRound
    const n = Math.max(1, people)
    const baseEach = Math.floor((total / n) * 100) / 100
    const rows = Array.from({ length: n }, (_, i) => {
      const isLast = i === n - 1
      const amount = isLast ? Math.round((total - baseEach * (n - 1)) * 100) / 100 : baseEach
      const tipShare = Math.round((tipAmt / n) * 100) / 100
      const billShare = Math.round((bill / n) * 100) / 100
      const taxShare = Math.round((taxAmt / n) * 100) / 100
      return { person: i + 1, billShare, taxShare, tipShare, amount }
    })
    const effectiveTipOnBill = bill > 0 ? (tipAmt / bill) * 100 : 0
    const subtotal = bill + taxAmt
    return {
      taxAmt,
      tipAmt,
      total,
      tipOn,
      rows,
      n,
      perPerson: baseEach,
      roundDelta,
      effectiveTipOnBill,
      subtotal,
    }
  }, [bill, tip, tax, people, roundUp, tipBase])

  const tipCompare = useMemo(() => {
    return COMPARE_TIPS.map((pct) => {
      const tipOn = tipBase === 'pre-tax' ? bill : bill + calc.taxAmt
      const tipAmt = (tipOn * pct) / 100
      let total = bill + calc.taxAmt + tipAmt
      if (roundUp) total = Math.ceil(total)
      return { pct, tipAmt, total, per: total / Math.max(1, people) }
    })
  }, [bill, calc.taxAmt, tipBase, roundUp, people])

  const summary = [
    `帳單 ${money(bill)}`,
    `稅 ${money(calc.taxAmt)}（${tax}%）`,
    `小費 ${money(calc.tipAmt)}（${tip}% · ${tipBase === 'pre-tax' ? '稅前' : '稅後'}）`,
    roundUp ? `總額已進位（+${money(calc.roundDelta)}）` : null,
    `總計 ${money(calc.total)}`,
    `${calc.n} 人分帳 · 約每人 ${money(calc.perPerson)}`,
    ...calc.rows.map((r) => `#${r.person} 應付 ${money(r.amount)}`),
  ]
    .filter(Boolean)
    .join('\n')

  const canSave = !error && Number.isFinite(bill) && bill >= 0

  function setNum(raw: string, min: number, max: number, set: (n: number) => void) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setError('請輸入有效數字')
      return
    }
    setError('')
    set(clamp(n, min, max))
  }

  function saveHistory() {
    if (!canSave) return
    setHistory((h) =>
      [
        {
          id: uid('tip'),
          at: Date.now(),
          bill,
          tip,
          tax,
          people: calc.n,
          roundUp,
          tipBase,
          tipAmt: calc.tipAmt,
          taxAmt: calc.taxAmt,
          total: calc.total,
          perPerson: calc.perPerson,
        },
        ...h,
      ].slice(0, HISTORY_CAP),
    )
  }

  function restore(item: HistoryItem) {
    setBill(clamp(item.bill, 0, BILL_MAX))
    setTip(clamp(item.tip, 0, PCT_MAX))
    setTax(clamp(item.tax, 0, PCT_MAX))
    setPeople(clamp(item.people, PEOPLE_MIN, PEOPLE_MAX))
    setRoundUp(item.roundUp)
    setTipBase(item.tipBase === 'pre-tax' ? 'pre-tax' : 'post-tax')
    setError('')
    setShareNote('')
  }

  function shareUrl() {
    const token = encodeShare({ bill, tip, tax, people, roundUp, tipBase })
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('s', token)
    return url.toString()
  }

  async function copySummary() {
    await copyText(summary)
    setCopied('summary')
    window.setTimeout(() => setCopied(null), 1500)
  }

  async function copyShareLink() {
    await copyText(shareUrl())
    setCopied('link')
    window.setTimeout(() => setCopied(null), 1500)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row tip-shell-actions">
          <ActionButton className="btn sm ghost" onClick={saveHistory} disabled={!canSave} icon="save">
            存入歷史
          </ActionButton>
          <ActionButton className="btn sm ghost" onClick={() => void copyShareLink()} icon="copy">
            {copied === 'link' ? '已複製連結' : '分享連結'}
          </ActionButton>
        </div>
      }
    >
      <div className="tip-calc">
        {shareNote && <p className="tip-share-banner muted">{shareNote}</p>}

        <div className="tip-main">
          <section className="panel tip-inputs">
            <h3 className="tip-panel-title">帳單設定</h3>
            <div className="tip-fields">
              <label className="stack">
                <span className="label">帳單金額</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={0}
                  max={BILL_MAX}
                  step={0.01}
                  value={bill}
                  onChange={(e) => setNum(e.target.value, 0, BILL_MAX, setBill)}
                />
              </label>
              <label className="stack">
                <span className="label">稅金 %</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={0}
                  max={PCT_MAX}
                  value={tax}
                  onChange={(e) => setNum(e.target.value, 0, PCT_MAX, setTax)}
                />
              </label>
              <label className="stack">
                <span className="label">小費 %</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={0}
                  max={PCT_MAX}
                  value={tip}
                  onChange={(e) => setNum(e.target.value, 0, PCT_MAX, setTip)}
                />
              </label>
              <label className="stack">
                <span className="label">分帳人數</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={PEOPLE_MIN}
                  max={PEOPLE_MAX}
                  value={people}
                  onChange={(e) => setNum(e.target.value, PEOPLE_MIN, PEOPLE_MAX, setPeople)}
                />
              </label>
            </div>
            {error && <p className="field-error">{error}</p>}

            <div className="tip-block">
              <div className="label">小費預設</div>
              <div className="tip-chips">
                {TIP_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn sm ${tip === p ? 'accent' : 'ghost'}`}
                    onClick={() => setTip(p)}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            <div className="tip-block">
              <div className="label">人數快捷</div>
              <div className="tip-chips">
                {PEOPLE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn sm ${people === p ? 'accent' : 'ghost'}`}
                    onClick={() => setPeople(p)}
                  >
                    {p} 人
                  </button>
                ))}
              </div>
            </div>

            <div className="tip-block">
              <div className="label">小費計算基準</div>
              <div className="tip-chips">
                <button
                  type="button"
                  className={`btn sm ${tipBase === 'pre-tax' ? 'accent' : 'ghost'}`}
                  onClick={() => setTipBase('pre-tax')}
                >
                  稅前小計
                </button>
                <button
                  type="button"
                  className={`btn sm ${tipBase === 'post-tax' ? 'accent' : 'ghost'}`}
                  onClick={() => setTipBase('post-tax')}
                >
                  稅後小計
                </button>
              </div>
              <p className="field-hint">
                以 {money(calc.tipOn)}（{tipBase === 'pre-tax' ? '帳單稅前' : '帳單＋稅'}）計算小費
              </p>
            </div>

            <label className="tip-check">
              <input type="checkbox" checked={roundUp} onChange={() => setRoundUp(!roundUp)} />
              <span>總額無條件進位到整數</span>
            </label>
          </section>

          <section className="panel tip-result">
            <h3 className="tip-panel-title">計算結果</h3>
            <div className="tip-hero">
              <p className="muted tip-hero-label">應付總額{roundUp ? '（已進位）' : ''}</p>
              <div className="tip-hero-num mono">{money(calc.total)}</div>
              {calc.n > 1 && (
                <p className="muted tip-hero-sub">約每人 {money(calc.perPerson)} · {calc.n} 人</p>
              )}
            </div>

            <div className="tip-stat-grid">
              <div className="tip-stat">
                <span className="muted">帳單</span>
                <strong className="mono">{money(bill)}</strong>
              </div>
              <div className="tip-stat">
                <span className="muted">稅金（{tax}%）</span>
                <strong className="mono">{money(calc.taxAmt)}</strong>
              </div>
              <div className="tip-stat">
                <span className="muted">小費（{tip}%）</span>
                <strong className="mono">{money(calc.tipAmt)}</strong>
              </div>
              <div className="tip-stat">
                <span className="muted">稅＋小費前小計</span>
                <strong className="mono">{money(calc.subtotal)}</strong>
              </div>
            </div>

            <ul className="tip-extra">
              <li>
                <span className="muted">相對帳單的實際小費比例</span>
                <strong>{calc.effectiveTipOnBill.toFixed(2)}%</strong>
              </li>
              {roundUp && (
                <li>
                  <span className="muted">進位差額</span>
                  <strong className="mono">+{money(calc.roundDelta)}</strong>
                </li>
              )}
              <li>
                <span className="muted">計算基準</span>
                <strong>{tipBase === 'pre-tax' ? '稅前小計' : '稅後小計'}</strong>
              </li>
            </ul>

            <div className="tip-actions">
              <ActionButton className="btn accent" onClick={saveHistory} disabled={!canSave} icon="save">
                存入歷史
              </ActionButton>
              <ActionButton className="btn ghost" onClick={() => void copySummary()} icon="copy">
                {copied === 'summary' ? '已複製明細' : '複製明細'}
              </ActionButton>
              <ActionButton className="btn ghost" onClick={() => void copyShareLink()} icon="copy">
                {copied === 'link' ? '已複製連結' : '分享連結'}
              </ActionButton>
            </div>
            <p className="muted tip-share-hint">
              分享連結使用編碼參數（含檢查碼），網址列無法直接改數字；僅防隨手竄改，非正式加密
            </p>
          </section>
        </div>

        <div className="tip-secondary">
          <section className="panel tip-compare">
            <h3 className="tip-panel-title">小費比例對照</h3>
            <p className="muted tip-sec-hint">同樣帳單與稅率下，不同小費％的總額差異</p>
            <ul className="tip-compare-list">
              {tipCompare.map((row) => (
                <li key={row.pct} className={`tip-compare-item${tip === row.pct ? ' is-active' : ''}`}>
                  <button type="button" className="tip-compare-btn" onClick={() => setTip(row.pct)}>
                    <span className="tip-compare-pct">{row.pct}%</span>
                    <span className="mono">{money(row.tipAmt)}</span>
                    <span className="muted mono">總 {money(row.total)}</span>
                    {calc.n > 1 && <span className="muted mono">／人 {money(row.per)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {calc.n > 1 ? (
            <section className="panel tip-split">
              <h3 className="tip-panel-title">每人分帳明細</h3>
              <div className="tip-split-table-wrap">
                <table className="tip-split-table">
                  <thead>
                    <tr>
                      <th>人</th>
                      <th>帳單</th>
                      <th>稅</th>
                      <th>小費</th>
                      <th>應付</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.rows.map((r) => (
                      <tr key={r.person}>
                        <td>#{r.person}</td>
                        <td className="mono">{money(r.billShare)}</td>
                        <td className="mono">{money(r.taxShare)}</td>
                        <td className="mono">{money(r.tipShare)}</td>
                        <td className="mono tip-split-pay">{money(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted tip-sec-hint">最後一人吸收四捨五入差額，確保加總等於總計</p>
            </section>
          ) : (
            <section className="panel tip-split tip-split-empty">
              <h3 className="tip-panel-title">每人分帳明細</h3>
              <p className="muted" style={{ margin: 0 }}>
                人數設為 2 人以上時會顯示分帳表
              </p>
            </section>
          )}
        </div>

        <section className="panel tip-history">
          <div className="tip-panel-head">
            <h3 className="tip-panel-title">計算歷史</h3>
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
          {!history.length && (
            <p className="muted" style={{ margin: 0 }}>
              尚無歷史，按「存入歷史」保留這次計算
            </p>
          )}
          <ul className="tip-history-list">
            {history.map((h) => (
              <li key={h.id} className="tip-history-card">
                <div className="tip-history-main">
                  <div className="tip-history-total mono">{money(h.total)}</div>
                  <div className="tip-history-meta">
                    <span className="tag">
                      {(h.tipBase ?? 'post-tax') === 'pre-tax' ? '稅前' : '稅後'} {h.tip}%
                    </span>
                    <span className="tag">{h.people} 人</span>
                    {h.roundUp && <span className="tag">進位</span>}
                  </div>
                  <div className="tip-history-grid">
                    <span className="muted">帳單</span>
                    <strong className="mono">{money(h.bill)}</strong>
                    <span className="muted">小費</span>
                    <strong className="mono">{money(h.tipAmt)}</strong>
                    <span className="muted">每人</span>
                    <strong className="mono">{money(h.perPerson)}</strong>
                  </div>
                  <div className="muted tip-history-time">
                    {new Date(h.at).toLocaleString('zh-TW')}
                  </div>
                </div>
                <div className="tip-history-actions">
                  <ActionButton className="btn sm ghost" onClick={() => restore(h)} icon="check">
                    套用
                  </ActionButton>
                  <DeleteButton
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                    label="刪除"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
