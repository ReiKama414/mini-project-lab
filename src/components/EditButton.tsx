import type { ButtonHTMLAttributes } from 'react'
import { IconEdit } from './icons'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string
}

/** Icon-only edit control — use `label` / aria-label for accessibility. */
export function EditButton({
  label = '編輯',
  className = '',
  type = 'button',
  title,
  'aria-label': ariaLabel,
  ...rest
}: Props) {
  const extras = className.trim().replace(/\b(btn|ghost|sm|btn-edit|btn-del)\b/g, '').replace(/\s+/g, ' ').trim()
  const classes = ['btn', 'ghost', 'sm', 'btn-edit', extras].filter(Boolean).join(' ')
  const name = ariaLabel || label
  return (
    <button
      type={type}
      className={classes}
      aria-label={name}
      data-tooltip={title ?? name}
      {...rest}
    >
      <IconEdit size={18} strokeWidth={2} />
    </button>
  )
}
