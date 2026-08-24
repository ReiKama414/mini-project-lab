import type { LucideProps } from 'lucide-react'
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Home,
  LayoutGrid,
  Maximize2,
  Menu,
  Minimize2,
  Search,
  X,
} from 'lucide-react'

const defaultProps: LucideProps = {
  size: 16,
  strokeWidth: 2,
  absoluteStrokeWidth: false,
  'aria-hidden': true,
}

export function IconArrowLeft(props: LucideProps) {
  return <ArrowLeft {...defaultProps} {...props} />
}

export function IconMenu(props: LucideProps) {
  return <Menu {...defaultProps} {...props} />
}

export function IconSearch(props: LucideProps) {
  return <Search {...defaultProps} {...props} />
}

export function IconHome(props: LucideProps) {
  return <Home {...defaultProps} {...props} />
}

export function IconGrid(props: LucideProps) {
  return <LayoutGrid {...defaultProps} {...props} />
}

export function IconCopy(props: LucideProps) {
  return <Copy {...defaultProps} {...props} />
}

export function IconCalendar(props: LucideProps) {
  return <CalendarDays {...defaultProps} {...props} />
}

export function IconClose(props: LucideProps) {
  return <X {...defaultProps} {...props} />
}

export function IconMaximize(props: LucideProps) {
  return <Maximize2 {...defaultProps} {...props} />
}

export function IconMinimize(props: LucideProps) {
  return <Minimize2 {...defaultProps} {...props} />
}
