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
  title: _title,
  ...rest
}: Props) {
  const label = labelTextFromChildren(children).trim()
  const key = icon === 'none' ? null : icon ?? resolveActionIconKey(label)
  const tipAttr = (rest as { 'data-tooltip'?: string })['data-tooltip']
  const tip = (typeof tipAttr === 'string' && tipAttr) || tooltip || label || undefined
  delete (rest as { 'data-tooltip'?: string })['data-tooltip']
  const extras = className
    .trim()
    .replace(/\b(btn|btn-add|btn-del|btn-edit)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const hasTone = /\b(accent|ghost|teal|danger)\b/.test(extras)
  const classes = ['btn', hasTone ? '' : 'accent', extras].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} data-tooltip={tip} {...rest}>
      {key ? <ActionIcon name={key} size={15} strokeWidth={2.25} /> : null}
      {children}
    </button>
  )
}
