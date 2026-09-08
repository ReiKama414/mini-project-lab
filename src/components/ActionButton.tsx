import type { ButtonHTMLAttributes, ReactNode } from 'react'
import {
  ActionIcon,
  labelTextFromChildren,
  resolveActionIconKey,
  type ActionIconKey,
} from '../lib/actionIcons'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode
  /** Override auto-detected icon */
  icon?: ActionIconKey | 'none'
  /** Tooltip text; defaults to visible label */
  tooltip?: string
  /** Icon only (no label text) — use for compact row actions like 複製 */
  iconOnly?: boolean
}

/**
 * Text action button with a leading icon (copy / save / clear…).
 * Do not use for filter chips or unit toggles.
 */
export function ActionButton({
  children,
  className = '',
  type = 'button',
  icon,
  tooltip,
  iconOnly = false,
  title: _title,
  'aria-label': ariaLabel,
  ...rest
}: Props) {
  const label = labelTextFromChildren(children).trim()
  const key = icon === 'none' ? null : icon ?? resolveActionIconKey(label || tooltip || '')
  const onlyIcon = iconOnly || (!label && !!key)
  const tipAttr = (rest as { 'data-tooltip'?: string })['data-tooltip']
  const tip =
    (typeof tipAttr === 'string' && tipAttr) ||
    tooltip ||
    label ||
    (key === 'copy' ? '複製' : undefined)
  delete (rest as { 'data-tooltip'?: string })['data-tooltip']
  const extras = className
    .trim()
    .replace(/\b(btn|btn-add|btn-del|btn-edit|btn-icon-action)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const hasTone = /\b(accent|ghost|teal|danger)\b/.test(extras)
  const classes = [
    'btn',
    hasTone ? '' : 'accent',
    onlyIcon ? 'btn-icon-action' : '',
    onlyIcon && !/\bsm\b/.test(extras) ? 'sm' : '',
    extras,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      aria-label={ariaLabel || (onlyIcon ? tip : undefined)}
      data-tooltip={tip}
      {...rest}
    >
      {key ? <ActionIcon name={key} size={onlyIcon ? 18 : 15} strokeWidth={onlyIcon ? 2 : 2.25} /> : null}
      {onlyIcon ? null : children}
    </button>
  )
}
