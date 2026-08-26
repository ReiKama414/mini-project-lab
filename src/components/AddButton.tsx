import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconPlus } from './icons'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode
}

/** Primary 「新增」action with a consistent plus icon. */
export function AddButton({ children = '新增', className = '', type = 'button', ...rest }: Props) {
  const extras = className.trim()
  const tone = /\bghost\b/.test(extras) ? 'ghost' : /\bteal\b/.test(extras) ? 'teal' : 'accent'
  const cleaned = extras.replace(/\b(btn|accent|ghost|teal|btn-add)\b/g, '').replace(/\s+/g, ' ').trim()
  const classes = ['btn', tone, 'btn-add', cleaned].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      <IconPlus size={16} strokeWidth={2.5} />
      {children}
    </button>
  )
}
