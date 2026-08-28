import type { PdfThumbMap } from '../lib/pdf'
import { cn } from '../lib/utils'

type Props = {
  pageCount: number
  thumbs: PdfThumbMap
  loading?: boolean
  /** 0-based selected pages */
  selected?: Set<number> | number[]
  onToggle?: (pageIndex: number) => void
  /** If set, only these indices show as active selection chrome */
  mode?: 'select' | 'view'
  className?: string
}

function asSet(selected?: Set<number> | number[]) {
  if (!selected) return new Set<number>()
  return selected instanceof Set ? selected : new Set(selected)
}

export function PdfThumbGrid({
  pageCount,
  thumbs,
  loading,
  selected,
  onToggle,
  mode = onToggle ? 'select' : 'view',
  className,
}: Props) {
  const sel = asSet(selected)
  if (pageCount < 1) return null

  return (
    <div className={cn('pdf-thumb-grid', className)} role="list">
      {Array.from({ length: pageCount }, (_, i) => {
        const active = sel.has(i)
        const clickable = mode === 'select' && !!onToggle
        const body = (
          <>
            {thumbs[i] ? (
              <img src={thumbs[i]} alt={`第 ${i + 1} 頁`} className="pdf-thumb-img" />
            ) : (
              <div className="pdf-thumb-placeholder">{loading ? '…' : i + 1}</div>
            )}
            <span className="pdf-thumb-label">第 {i + 1} 頁</span>
          </>
        )
        const classNames = cn('pdf-thumb-card', active && 'is-selected', clickable && 'is-clickable')
        const title = clickable ? `第 ${i + 1} 頁（點擊選取）` : `第 ${i + 1} 頁`

        if (clickable) {
          return (
            <button
              key={i}
              type="button"
              role="listitem"
              className={classNames}
              onClick={() => onToggle?.(i)}
              title={title}
            >
              {body}
            </button>
          )
        }

        return (
          <div key={i} role="listitem" className={classNames} title={title}>
            {body}
          </div>
        )
      })}
    </div>
  )
}
