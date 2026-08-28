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

/** Match a file against an HTML `accept` string (MIME, wildcards, extensions, comma lists). */
export function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  if (!tokens.length) return true

  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot) : ''

  return tokens.some((token) => {
    if (token.startsWith('.')) {
      return ext === token || name.endsWith(token)
    }
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, -1) // e.g. "image/"
      return type.startsWith(prefix)
    }
    return type === token
  })
}

export function FileDrop({
  accept,
  multiple = false,
  maxBytes,
  maxFiles = multiple ? 50 : 1,
  disabled = false,
  label,
  hint,
  className,
  onFiles,
  children,
}: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [localError, setLocalError] = useState('')

  const isImageAccept = Boolean(accept && /image\//i.test(accept))
  const resolvedLabel = label ?? (isImageAccept ? '拖放圖片到此，或點擊選擇' : '拖放檔案到此，或點擊選擇')
  const resolvedHint = hint ?? (isImageAccept ? '支援拖放' : undefined)

  const take = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || disabled) return
      const raw = Array.from(list).slice(0, maxFiles)
      if (!raw.length) return

      const matched = accept?.trim() ? raw.filter((f) => fileMatchesAccept(f, accept)) : raw
      if (!matched.length) {
        setLocalError('沒有符合的檔案類型')
        return
      }

      if (maxBytes != null) {
        const tooBig = matched.find((f) => f.size > maxBytes)
        if (tooBig) {
          setLocalError(`「${tooBig.name}」超過上限 ${formatBytes(maxBytes)}`)
          return
        }
      }
      setLocalError('')
      onFiles(multiple ? matched : matched.slice(0, 1))
    },
    [accept, disabled, maxBytes, maxFiles, multiple, onFiles],
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
        <span className="file-drop-label">{resolvedLabel}</span>
        {resolvedHint && <span className="file-drop-hint">{resolvedHint}</span>}
        {children}
      </label>
      {localError && <p className="field-error">{localError}</p>}
    </div>
  )
}
