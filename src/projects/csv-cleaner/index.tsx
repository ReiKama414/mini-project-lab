import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv, stringifyCsv } from '../../lib/csv'
import { ActionButton } from '../../components/ActionButton'
import { FtMetric, FtMetricGrid, FtSection, FtToolHero, FtToolRoot } from '../../components/FeatureToolUI'

const meta: ProjectMeta = getProject('csv-cleaner') ?? {
  slug: 'csv-cleaner',
  title: 'CSV 清理',
  description: '修剪空白、去重與移除空列',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 5 * 1024 * 1024

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:csv-cleaner:input',
    'name, city\nAda, Taipei\nAda, Taipei\nLin,  \n,Kaohsiung\n  Bob , Tainan  ',
  )
  const [trimCells, setTrimCells] = useLocalStorage('lab:csv-cleaner:trim', true)
  const [dropEmpty, setDropEmpty] = useLocalStorage('lab:csv-cleaner:empty', true)
  const [dedupe, setDedupe] = useLocalStorage('lab:csv-cleaner:dedupe', true)
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  function clean() {
    if (!isNonEmpty(input)) {
      setError('請輸入 CSV')
      return
    }
    if (charCount(input) > MAX) {
      setError(`超過 ${MAX} 字元`)
      return
    }
    try {
      let rows = parseCsv(input)
      const before = rows.length
      if (trimCells) rows = rows.map((r) => r.map((c) => c.trim()))
      if (dropEmpty) rows = rows.filter((r) => r.some((c) => c.length > 0))
      if (dedupe) {
        const seen = new Set<string>()
        rows = rows.filter((r) => {
          const k = r.join('\0').toLowerCase()
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      }
      setOut(stringifyCsv(rows))
      const cols = rows[0]?.length ?? 0
      setStats(`列數 ${before} → ${rows.length} · ${cols} 欄`)
      setError('')
      setCopied(false)
    } catch {
      setError('解析失敗')
      setOut('')
    }
  }

  return (
    <FeatureLayout
      meta={meta}
      footerHint="以 RFC4180 解析後修剪、去重。"
      infoItems={[
        { label: '功能', value: '修剪空白、移除空列、去除重複列' },
        { label: '上傳', value: formatBytes(FILE_MAX) },
      ]}
      faq={[ftPrivacyLocal]}
      toolbar={
        <>
          <FileDrop
            accept=".csv,text/csv"
            maxBytes={FILE_MAX}
            disabled={busy}
            label="拖放 CSV 到此，或點擊選擇"
            hint={`上限 ${formatBytes(FILE_MAX)}`}
            onFiles={(files) => {
              void (async () => {
                const f = files[0]
                if (!f) return
                setBusy(true)
                try {
                  setInput(limitText(await f.text(), MAX))
                  setError('')
                } catch {
                  setError('讀取失敗')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={trimCells} onChange={(e) => setTrimCells(e.target.checked)} />
              修剪儲存格空白
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={dropEmpty} onChange={(e) => setDropEmpty(e.target.checked)} />
              移除空列
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
              去除重複列
            </label>
          </div>
          <ActionButton className="btn accent" onClick={clean} disabled={!isNonEmpty(input) || busy} icon="none">
            清理
          </ActionButton>
        </>
      }
      actions={
        <>
          <ActionButton
            className="btn sm ghost"
            disabled={!out}
            onClick={async () => {
              await copyText(out)
              setCopied(true)
            }}
            icon="copy"
          >
            {copied ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!out}
            onClick={() => downloadText('cleaned.csv', out, 'text/csv')}
            icon="download"
          >
            下載
          </ActionButton>
        </>
      }
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🧹"
          title={stats || 'CSV 清理'}
          subtitle={out ? `輸出 ${charCount(out).toLocaleString()} 字元` : '設定選項後按「清理」'}
          badge={out ? <span className="tag">已清理</span> : null}
        />
        <FtMetricGrid>
          <FtMetric label="輸入字元" value={`${charCount(input).toLocaleString()} / ${MAX.toLocaleString()}`} mono />
          <FtMetric label="修剪" value={trimCells ? '開' : '關'} />
          <FtMetric label="去空列" value={dropEmpty ? '開' : '關'} />
          <FtMetric label="去重" value={dedupe ? '開' : '關'} />
        </FtMetricGrid>
        <label className="stack">
          <span className="label">輸入 CSV</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={8}
            value={input}
            maxLength={MAX}
            disabled={busy}
            onChange={(e) => setInput(limitText(e.target.value, MAX))}
          />
        </label>
        {error && <p className="field-error">{error}</p>}
        {stats && !error && <p className="field-hint">{stats}</p>}
        {out && (
          <FtSection title="清理結果">
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', margin: 0 }}>
              {out}
            </pre>
          </FtSection>
        )}
      </FtToolRoot>
    </FeatureLayout>
  )
}
