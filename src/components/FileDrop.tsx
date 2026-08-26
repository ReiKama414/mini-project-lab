import { useCallback, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { formatBytes, cn } from '../lib/utils'

type Props = {
  accept?: string
  multiple?: boolean
  maxBytes?: number
  maxFiles?: number
  disabled?: boolean
  label?: string
  hint?: string
  className?: string
  onFiles: (files: File[]) => void
  children?: ReactNode
}

export function FileDrop({
  accept,
  multiple = false,
  maxBytes,
  maxFiles = multiple ? 50 : 1,
  disabled = false,
  label = '拖放檔案到此，或點擊選擇',
  hint,
  className,
  onFiles,
  children,
}: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [localError, setLocalError] = useState('')

  const take = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || disabled) return
      const arr = Array.from(list).slice(0, maxFiles)
      if (!arr.length) return
      if (maxBytes != null) {
        const tooBig = arr.find((f) => f.size > maxBytes)
        if (tooBig) {
          setLocalError(`「${tooBig.name}」超過上限 ${formatBytes(maxBytes)}`)
          return
        }
      }
      setLocalError('')
      onFiles(multiple ? arr : arr.slice(0, 1))
    },
    [disabled, maxBytes, maxFiles, multiple, onFiles],
  )

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setOver(true)
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOver(false)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOver(false)
    take(e.dataTransfer.files)
  }

  return (
    <div className={cn('stack', className)}>
      <label
        htmlFor={inputId}
        className={cn('file-drop', over && 'is-over', disabled && 'is-disabled')}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          className="file-drop-input"
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            take(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="file-drop-label">{label}</span>
        {hint && <span className="file-drop-hint">{hint}</span>}
        {children}
      </label>
      {localError && <p className="field-error">{localError}</p>}
    </div>
  )
}
