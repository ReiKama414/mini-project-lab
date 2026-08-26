import type { ButtonHTMLAttributes } from 'react'
import { IconTrash } from './icons'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string
}

/** Icon-only delete control — use `label` / aria-label for accessibility. */
export function DeleteButton({
  label = '刪除',
  className = '',
  type = 'button',
  title,
  'aria-label': ariaLabel,
  ...rest
}: Props) {
  const extras = className.trim().replace(/\b(btn|ghost|sm|btn-del)\b/g, '').replace(/\s+/g, ' ').trim()
  const classes = ['btn', 'ghost', 'sm', 'btn-del', extras].filter(Boolean).join(' ')
  const name = ariaLabel || label
  return (
    <button type={type} className={classes} aria-label={name} title={title ?? name} {...rest}>
      <IconTrash size={15} strokeWidth={2.25} />
    </button>
  )
}
