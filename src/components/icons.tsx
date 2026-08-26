import type { LucideProps } from 'lucide-react'
import type { SVGProps } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Home,
  LayoutGrid,
  Maximize2,
  Menu,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  SkipForward,
  Trash2,
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

export function IconPlus(props: LucideProps) {
  return <Plus {...defaultProps} {...props} />
}

export function IconPlay(props: LucideProps) {
  return <Play {...defaultProps} {...props} />
}

export function IconPause(props: LucideProps) {
  return <Pause {...defaultProps} {...props} />
}

export function IconReset(props: LucideProps) {
  return <RotateCcw {...defaultProps} {...props} />
}

export function IconTrash(props: LucideProps) {
  return <Trash2 {...defaultProps} {...props} />
}

export function IconSkip(props: LucideProps) {
  return <SkipForward {...defaultProps} {...props} />
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

export function IconSidebarClose(props: LucideProps) {
  return <PanelLeftClose {...defaultProps} {...props} />
}

export function IconSidebarOpen(props: LucideProps) {
  return <PanelLeftOpen {...defaultProps} {...props} />
}

/** GitHub mark (brand icon not shipped in this lucide-react version). */
export function IconGithub({
  size = 16,
  className,
  ...rest
}: {
  size?: number
  className?: string
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
      {...rest}
    >
      <path d="M12 2C6.477 2 2 6.586 2 12.253c0 4.537 2.865 8.387 6.839 9.748.5.094.682-.222.682-.482 0-.237-.009-.866-.013-1.7-2.782.617-3.369-1.37-3.369-1.37-.455-1.18-1.11-1.495-1.11-1.495-.908-.635.069-.622.069-.622 1.003.072 1.532 1.055 1.532 1.055.892 1.563 2.341 1.112 2.91.85.091-.662.35-1.112.636-1.367-2.22-.259-4.555-1.14-4.555-5.077 0-1.122.39-2.04 1.029-2.759-.103-.26-.446-1.302.098-2.714 0 0 .84-.275 2.75 1.052A9.34 9.34 0 0 1 12 6.844c.85.004 1.705.117 2.504.343 1.909-1.327 2.747-1.052 2.747-1.052.546 1.412.203 2.454.1 2.714.64.719 1.028 1.637 1.028 2.759 0 3.948-2.339 4.815-4.566 5.068.359.317.679.943.679 1.901 0 1.371-.012 2.477-.012 2.813 0 .263.18.58.688.481A10.02 10.02 0 0 0 22 12.253C22 6.586 17.523 2 12 2z" />
    </svg>
  )
}
