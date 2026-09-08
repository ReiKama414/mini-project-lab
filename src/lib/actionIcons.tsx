import type { LucideProps } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  ArrowLeftRight,
  Check,
  Download,
  Pencil,
  Save,
  Upload,
} from 'lucide-react'
import {
  IconClose,
  IconCopy,
  IconPause,
  IconPlay,
  IconPlus,
  IconReset,
  IconSearch,
  IconTrash,
} from '../components/icons'

export type ActionIconKey =
  | 'copy'
  | 'trash'
  | 'reset'
  | 'download'
  | 'save'
  | 'plus'
  | 'check'
  | 'edit'
  | 'upload'
  | 'play'
  | 'pause'
  | 'search'
  | 'close'
  | 'swap'

type IconFn = (props: LucideProps) => ReactNode

const iconMap: Record<ActionIconKey, IconFn> = {
  copy: (p) => <IconCopy {...p} />,
  trash: (p) => <IconTrash {...p} />,
  reset: (p) => <IconReset {...p} />,
  download: (p) => <Download size={16} strokeWidth={2} aria-hidden {...p} />,
  save: (p) => <Save size={16} strokeWidth={2} aria-hidden {...p} />,
  plus: (p) => <IconPlus {...p} />,
  check: (p) => <Check size={16} strokeWidth={2} aria-hidden {...p} />,
  edit: (p) => <Pencil size={16} strokeWidth={2} aria-hidden {...p} />,
  upload: (p) => <Upload size={16} strokeWidth={2} aria-hidden {...p} />,
  play: (p) => <IconPlay {...p} />,
  pause: (p) => <IconPause {...p} />,
  search: (p) => <IconSearch {...p} />,
  close: (p) => <IconClose {...p} />,
  swap: (p) => <ArrowLeftRight size={16} strokeWidth={2} aria-hidden {...p} />,
}

/** Resolve icon key from visible action label (Chinese / English verbs). */
export function resolveActionIconKey(label: string): ActionIconKey | null {
  const t = label.trim()
  if (!t) return null

  if (/清空|刪除|清除|移除|銷毀/.test(t)) return 'trash'
  if (/已複製|複製|拷貝|copy/i.test(t)) return 'copy'
  if (/重新|刷新|更新中|抓匯率|重置|重設|reload|refresh/i.test(t)) return 'reset'
  if (/下載|匯出|導出|export|download/i.test(t)) return 'download'
  if (/匯入|上傳|import|upload/i.test(t)) return 'upload'
  if (/儲存|存入|保存|save/i.test(t)) return 'save'
  if (/新增|加入|建立|創建|add|create/i.test(t)) return 'plus'
  if (/編輯|修改|edit/i.test(t)) return 'edit'
  if (/套用|確認|確定|完成|apply|done/i.test(t)) return 'check'
  if (/搜尋|搜索|查找|search/i.test(t)) return 'search'
  if (/暫停|pause/i.test(t)) return 'pause'
  if (/開始|播放|繼續|start|play|resume/i.test(t)) return 'play'
  if (/交換|對調|swap/i.test(t) || t.includes('⇄')) return 'swap'
  if (/收藏/.test(t)) return 'plus'
  if (/取消|關閉|close|cancel/i.test(t)) return 'close'
  if (/產生|生成|計算|轉換|送出|發送|執行|generate|run|convert|send/i.test(t)) return 'check'

  return null
}

export function ActionIcon({
  name,
  size = 16,
  strokeWidth = 2,
}: {
  name: ActionIconKey
  size?: number
  strokeWidth?: number
}) {
  return iconMap[name]({ size, strokeWidth })
}

export function labelTextFromChildren(children: unknown): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) {
    return children.map(labelTextFromChildren).join('')
  }
  if (typeof children === 'object' && children !== null && 'props' in (children as object)) {
    const props = (children as { props?: { children?: unknown } }).props
    if (props && 'children' in props) return labelTextFromChildren(props.children)
  }
  return ''
}
