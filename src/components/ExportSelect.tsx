import type { SelectHTMLAttributes } from 'react'
import { ActionIcon } from '../lib/actionIcons'

export type ExportOption = { value: string; label: string }

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'defaultValue' | 'children'> & {
  options: ExportOption[]
  onExport: (kind: string) => void
  placeholder?: string
}

/** Select styled like an action control, with a leading download icon. */
export function ExportSelect({
  options,
  onExport,
  placeholder = '匯出…',
  className = '',
  'aria-label': ariaLabel = '匯出',
  disabled,
  ...rest
}: Props) {
  return (
    <label className={`export-select${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <span className="export-select-icon" aria-hidden>
        <ActionIcon name="download" size={15} strokeWidth={2.25} />
      </span>
      <select
        className="field export-select-field"
        defaultValue=""
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => {
          const kind = e.target.value
          e.target.value = ''
          if (kind) onExport(kind)
        }}
        {...rest}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
