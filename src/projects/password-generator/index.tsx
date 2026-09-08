import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, limitText, parseNumber, uid } from '../../lib/utils'

const LENGTH_MIN = 8
const LENGTH_MAX = 128
const BATCH_MIN = 1
const BATCH_MAX = 20
const HISTORY_CAP = 30
const WORD_COUNT_MIN = 2
const WORD_COUNT_MAX = 12
const CUSTOM_SET_MAX = 200
const CUSTOM_WORDS_MAX = 4000

const meta = getProject('password-generator')!

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*-_=+?~',
}

const AMBIGUOUS = /[0OIl1]/g

/** Compact diceware-style word pool (English, memorable) */
const DEFAULT_WORDS = [
  'able', 'acid', 'acre', 'aged', 'also', 'area', 'army', 'atom', 'aunt', 'auto',
  'away', 'axis', 'back', 'bake', 'ball', 'band', 'bank', 'base', 'bath', 'beam',
  'bean', 'bear', 'beat', 'bell', 'belt', 'bend', 'best', 'bike', 'bird', 'bite',
  'blue', 'boat', 'body', 'bold', 'bone', 'book', 'boot', 'born', 'both', 'bowl',
  'bulk', 'burn', 'bush', 'busy', 'cake', 'call', 'calm', 'camp', 'card', 'care',
  'case', 'cash', 'cast', 'cave', 'cell', 'chat', 'chip', 'city', 'clap', 'clay',
  'clip', 'club', 'coal', 'coat', 'code', 'coil', 'cold', 'come', 'cook', 'cool',
  'cope', 'copy', 'cord', 'core', 'corn', 'cost', 'cozy', 'crab', 'crew', 'crop',
  'crow', 'cube', 'cult', 'curb', 'cure', 'cute', 'damp', 'dare', 'dark', 'dart',
  'dash', 'data', 'dawn', 'deal', 'dear', 'deck', 'deep', 'deer', 'desk', 'dial',
  'dice', 'diet', 'dime', 'dirt', 'disc', 'dock', 'dome', 'door', 'dose', 'down',
  'draw', 'drip', 'drop', 'drum', 'dual', 'duck', 'duke', 'dune', 'dusk', 'dust',
  'duty', 'each', 'earn', 'ease', 'east', 'easy', 'edge', 'edit', 'else', 'emit',
  'epic', 'even', 'ever', 'evil', 'exam', 'exit', 'face', 'fact', 'fade', 'fail',
  'fair', 'fall', 'fame', 'farm', 'fast', 'fate', 'fear', 'feed', 'feel', 'fern',
  'file', 'fill', 'film', 'find', 'fine', 'fire', 'firm', 'fish', 'five', 'flag',
  'flat', 'flaw', 'flex', 'flip', 'flow', 'foam', 'fold', 'folk', 'font', 'food',
  'fool', 'foot', 'ford', 'fork', 'form', 'fort', 'four', 'free', 'frog', 'from',
  'fuel', 'full', 'fund', 'fuse', 'gain', 'game', 'gate', 'gaze', 'gear', 'gift',
  'girl', 'give', 'glad', 'glow', 'glue', 'goal', 'goat', 'gold', 'golf', 'good',
  'grab', 'gray', 'grid', 'grim', 'grin', 'grow', 'gulf', 'hair', 'half', 'hall',
  'hand', 'hard', 'harm', 'harp', 'hate', 'have', 'hawk', 'haze', 'head', 'heal',
  'heap', 'hear', 'heat', 'heel', 'heir', 'held', 'helm', 'help', 'herb', 'hero',
  'hide', 'high', 'hill', 'hint', 'hire', 'hold', 'hole', 'home', 'honey', 'hope',
  'horn', 'host', 'hour', 'huge', 'hull', 'hunt', 'hurt', 'icon', 'idea', 'idle',
  'inch', 'into', 'iris', 'iron', 'item', 'jade', 'jazz', 'join', 'joke', 'jump',
  'june', 'jury', 'just', 'keen', 'keep', 'kept', 'kick', 'kind', 'king', 'kite',
  'knee', 'knew', 'knit', 'knot', 'know', 'lace', 'lack', 'lady', 'lake', 'lamp',
  'land', 'lane', 'last', 'late', 'lawn', 'lead', 'leaf', 'lean', 'left', 'lend',
  'lens', 'less', 'liar', 'life', 'lift', 'like', 'lime', 'line', 'link', 'lion',
  'list', 'live', 'load', 'loan', 'lock', 'loft', 'logo', 'long', 'look', 'loop',
  'lord', 'lore', 'lose', 'loss', 'loud', 'love', 'luck', 'lump', 'lung', 'lure',
  'lush', 'made', 'mail', 'main', 'make', 'male', 'mall', 'many', 'mark', 'mask',
  'mass', 'mate', 'math', 'maze', 'meal', 'mean', 'meat', 'meet', 'melt', 'memo',
  'menu', 'mere', 'mesh', 'mile', 'milk', 'mind', 'mine', 'mint', 'miss', 'mist',
  'moat', 'mode', 'mood', 'moon', 'more', 'moss', 'most', 'move', 'much', 'mule',
  'muse', 'must', 'myth', 'nail', 'name', 'navy', 'near', 'neck', 'need', 'neon',
  'nest', 'news', 'next', 'nice', 'nine', 'node', 'noon', 'norm', 'nose', 'note',
  'noun', 'oak', 'oath', 'obey', 'odds', 'odor', 'okay', 'omit', 'once', 'only',
  'open', 'oral', 'orb', 'oval', 'oven', 'over', 'owed', 'own', 'pace', 'pack',
  'page', 'paid', 'pain', 'pair', 'palm', 'park', 'part', 'pass', 'past', 'path',
  'peak', 'pear', 'peat', 'peck', 'peel', 'peer', 'pest', 'pick', 'pier', 'pike',
  'pile', 'pill', 'pine', 'pink', 'pipe', 'plan', 'play', 'plot', 'plug', 'plus',
  'poem', 'poet', 'pole', 'poll', 'pond', 'pool', 'poor', 'port', 'pose', 'post',
  'pour', 'prey', 'pull', 'pulp', 'pump', 'pure', 'push', 'quit', 'quiz', 'race',
  'rack', 'raft', 'rage', 'raid', 'rail', 'rain', 'rake', 'rank', 'rare', 'rate',
  'read', 'real', 'reed', 'reef', 'rest', 'rice', 'rich', 'ride', 'ring', 'riot',
  'rise', 'risk', 'road', 'roam', 'rock', 'role', 'roll', 'roof', 'room', 'root',
  'rope', 'rose', 'ruby', 'ruin', 'rule', 'rush', 'rust', 'safe', 'sage', 'said',
  'sail', 'sake', 'sale', 'salt', 'same', 'sand', 'save', 'scan', 'seal', 'seat',
  'seed', 'seek', 'seem', 'self', 'sell', 'send', 'ship', 'shop', 'shot', 'show',
  'shut', 'side', 'sign', 'silk', 'sing', 'sink', 'site', 'size', 'skin', 'skip',
  'slab', 'slam', 'slim', 'slip', 'slot', 'slow', 'snap', 'snow', 'soap', 'soft',
  'soil', 'sold', 'sole', 'some', 'song', 'soon', 'sort', 'soul', 'soup', 'span',
  'spin', 'spot', 'star', 'stay', 'stem', 'step', 'stir', 'stop', 'such', 'suit',
  'sure', 'surf', 'swan', 'swim', 'tail', 'take', 'tale', 'talk', 'tall', 'tank',
  'tape', 'task', 'team', 'tear', 'tech', 'tell', 'tend', 'tent', 'term', 'test',
  'text', 'than', 'that', 'them', 'then', 'they', 'thin', 'this', 'tide', 'tile',
  'time', 'tiny', 'tire', 'toad', 'tone', 'took', 'tool', 'tops', 'torn', 'tour',
  'town', 'trap', 'tray', 'tree', 'trim', 'trip', 'true', 'tube', 'tune', 'turn',
  'twin', 'type', 'ugly', 'unit', 'upon', 'urge', 'used', 'user', 'vain', 'vast',
  'veil', 'vein', 'vent', 'verb', 'very', 'vest', 'veto', 'vice', 'view', 'vine',
  'visa', 'void', 'volt', 'vote', 'wade', 'wage', 'wait', 'wake', 'walk', 'wall',
  'want', 'warm', 'warn', 'wash', 'wave', 'weak', 'wear', 'week', 'well', 'west',
  'what', 'when', 'whip', 'wide', 'wife', 'wild', 'will', 'wind', 'wine', 'wing',
  'wipe', 'wire', 'wise', 'wish', 'with', 'wolf', 'wood', 'wool', 'word', 'work',
  'worm', 'worn', 'yard', 'yarn', 'year', 'yell', 'yoga', 'your', 'zero', 'zone',
]

type Mode = 'classic' | 'passphrase' | 'recipe'
type Opts = { lower: boolean; upper: boolean; digits: boolean; symbols: boolean }
type IngredientKind = 'word' | 'digits' | 'symbols' | 'custom'
type Ingredient = { id: string; kind: IngredientKind; count: number; text: string }

type HistoryItem = {
  id: string
  pwd: string
  at: number
  length: number
  score: number
  mode: Mode
  entropy: number
}

const PRESETS: { label: string; length: number; opts: Opts; excludeAmbiguous: boolean }[] = [
  { label: '網站帳號', length: 16, opts: { lower: true, upper: true, digits: true, symbols: true }, excludeAmbiguous: true },
  { label: 'PIN 風格', length: 8, opts: { lower: false, upper: false, digits: true, symbols: false }, excludeAmbiguous: false },
  { label: '字母數字', length: 20, opts: { lower: true, upper: true, digits: true, symbols: false }, excludeAmbiguous: true },
  { label: '高強度', length: 32, opts: { lower: true, upper: true, digits: true, symbols: true }, excludeAmbiguous: false },
]

const RECIPE_STYLES: { label: string; hint: string; items: Omit<Ingredient, 'id'>[] }[] = [
  {
    label: '三段詞＋數字',
    hint: 'word-word-word-####',
    items: [
      { kind: 'word', count: 1, text: '' },
      { kind: 'custom', count: 1, text: '-' },
      { kind: 'word', count: 1, text: '' },
      { kind: 'custom', count: 1, text: '-' },
      { kind: 'word', count: 1, text: '' },
      { kind: 'custom', count: 1, text: '-' },
      { kind: 'digits', count: 4, text: '' },
    ],
  },
  {
    label: '詞彙夾符號',
    hint: 'Word!####Word',
    items: [
      { kind: 'word', count: 1, text: '' },
      { kind: 'symbols', count: 1, text: '' },
      { kind: 'digits', count: 4, text: '' },
      { kind: 'word', count: 1, text: '' },
    ],
  },
  {
    label: '公司風格',
    hint: 'Acme-####-word!',
    items: [
      { kind: 'custom', count: 1, text: 'Acme' },
      { kind: 'custom', count: 1, text: '-' },
      { kind: 'digits', count: 4, text: '' },
      { kind: 'custom', count: 1, text: '-' },
      { kind: 'word', count: 1, text: '' },
      { kind: 'symbols', count: 1, text: '' },
    ],
  },
  {
    label: '短口令',
    hint: 'word.word##',
    items: [
      { kind: 'word', count: 1, text: '' },
      { kind: 'custom', count: 1, text: '.' },
      { kind: 'word', count: 1, text: '' },
      { kind: 'digits', count: 2, text: '' },
    ],
  },
]

const STRENGTH = ['很弱', '弱', '普通', '強', '很強', '極強']

function secureIndex(max: number) {
  if (max <= 0) return 0
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0]! % max
}

function securePick(pool: string) {
  return pool[secureIndex(pool.length)]!
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function strengthScore(pwd: string) {
  let score = 0
  if (pwd.length >= 12) score += 1
  if (pwd.length >= 16) score += 1
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1
  if (/\d/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1
  return score
}

function parseWordList(raw: string) {
  const parts = raw
    .split(/[\s,;|]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && w.length <= 24)
  return [...new Set(parts)]
}

function formatEntropy(bits: number) {
  if (!Number.isFinite(bits) || bits <= 0) return '—'
  if (bits < 10) return `${bits.toFixed(1)} bit`
  return `${Math.round(bits)} bit`
}

function crackHint(bits: number) {
  if (!Number.isFinite(bits) || bits <= 0) return '無法估計'
  // Rough: 1e9 guesses/sec offline
  const seconds = Math.pow(2, Math.max(0, bits - 30)) / 1e9
  if (seconds < 1) return '瞬間（弱）'
  if (seconds < 60) return `約 ${Math.ceil(seconds)} 秒`
  if (seconds < 3600) return `約 ${Math.ceil(seconds / 60)} 分鐘`
  if (seconds < 86400) return `約 ${(seconds / 3600).toFixed(1)} 小時`
  if (seconds < 86400 * 365) return `約 ${(seconds / 86400).toFixed(0)} 天`
  if (seconds < 86400 * 365 * 100) return `約 ${(seconds / (86400 * 365)).toFixed(0)} 年`
  return '極久（理論）'
}

function newIngredient(kind: IngredientKind = 'word'): Ingredient {
  return {
    id: uid('ing'),
    kind,
    count: kind === 'digits' ? 4 : kind === 'symbols' ? 1 : 1,
    text: kind === 'custom' ? '-' : '',
  }
}

function charsetPool(opts: Opts, excludeAmbiguous: boolean, extraInclude: string, extraExclude: string) {
  const parts: { key: keyof Opts; set: string }[] = [
    { key: 'lower', set: SETS.lower },
    { key: 'upper', set: SETS.upper },
    { key: 'digits', set: SETS.digits },
    { key: 'symbols', set: SETS.symbols },
  ]
  const required: string[] = []
  let pool = ''
  for (const { key, set } of parts) {
    if (!opts[key]) continue
    let s = set
    if (excludeAmbiguous) s = s.replace(AMBIGUOUS, '')
    for (const ch of extraExclude) s = s.split(ch).join('')
    if (!s) continue
    pool += s
    required.push(securePick(s))
  }
  for (const ch of extraInclude) {
    if (extraExclude.includes(ch)) continue
    if (!pool.includes(ch)) pool += ch
  }
  for (const ch of extraExclude) pool = pool.split(ch).join('')
  return { pool: [...new Set(pool.split(''))].join(''), required }
}

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:password-generator:mode', 'classic')
  const [length, setLength] = useLocalStorage('lab:password-generator:length', 20)
  const [opts, setOpts] = useLocalStorage<Opts>('lab:password-generator:opts', {
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
  })
  const [excludeAmbiguous, setExcludeAmbiguous] = useLocalStorage('lab:password-generator:ambiguous', true)
  const [extraInclude, setExtraInclude] = useLocalStorage('lab:password-generator:include', '')
  const [extraExclude, setExtraExclude] = useLocalStorage('lab:password-generator:exclude', '')
  const [batch, setBatch] = useLocalStorage('lab:password-generator:batch', 1)
  const [saveHistory, setSaveHistory] = useLocalStorage('lab:password-generator:saveHistory', false)

  const [wordCount, setWordCount] = useLocalStorage('lab:password-generator:wordCount', 4)
  const [separator, setSeparator] = useLocalStorage('lab:password-generator:sep', '-')
  const [capitalizeWords, setCapitalizeWords] = useLocalStorage('lab:password-generator:cap', true)
  const [passDigits, setPassDigits] = useLocalStorage('lab:password-generator:passDigits', 2)
  const [passSymbol, setPassSymbol] = useLocalStorage('lab:password-generator:passSymbol', true)
  const [customWordsRaw, setCustomWordsRaw] = useLocalStorage('lab:password-generator:customWords', '')

  const [recipe, setRecipe] = useLocalStorage<Ingredient[]>('lab:password-generator:recipe', [
    newIngredient('word'),
    { ...newIngredient('custom'), text: '-' },
    newIngredient('word'),
    { ...newIngredient('custom'), text: '-' },
    newIngredient('word'),
    { ...newIngredient('custom'), text: '-' },
    { ...newIngredient('digits'), count: 4 },
  ])

  const [pwd, setPwd] = useState('')
  const [batchList, setBatchList] = useState<string[]>([])
  const [copied, setCopied] = useState<'one' | 'all' | null>(null)
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:password-generator:history-v3', [])
  const [histFilter, setHistFilter] = useState('')
  const [minScore, setMinScore] = useState(0)

  const wordPool = useMemo(() => {
    const custom = parseWordList(customWordsRaw)
    return custom.length >= 8 ? custom : DEFAULT_WORDS
  }, [customWordsRaw])

  const usingCustomWords = parseWordList(customWordsRaw).length >= 8

  const classicPoolInfo = useMemo(() => {
    const { pool } = charsetPool(opts, excludeAmbiguous, extraInclude, extraExclude)
    const bits = length > 0 && pool.length > 0 ? length * Math.log2(pool.length) : 0
    return { size: pool.length, bits }
  }, [opts, excludeAmbiguous, extraInclude, extraExclude, length])

  const passInfo = useMemo(() => {
    const n = clamp(wordCount, WORD_COUNT_MIN, WORD_COUNT_MAX)
    const wordBits = n * Math.log2(Math.max(2, wordPool.length))
    const digBits = clamp(passDigits, 0, 8) * Math.log2(10)
    const symBits = passSymbol ? Math.log2(SETS.symbols.length) : 0
    return { bits: wordBits + digBits + symBits, words: wordPool.length }
  }, [wordCount, wordPool.length, passDigits, passSymbol])

  const recipeInfo = useMemo(() => {
    let bits = 0
    const preview: string[] = []
    for (const item of recipe) {
      if (item.kind === 'word') {
        bits += Math.log2(Math.max(2, wordPool.length))
        preview.push('詞')
      } else if (item.kind === 'digits') {
        const c = clamp(item.count, 1, 12)
        bits += c * Math.log2(10)
        preview.push(`#×${c}`)
      } else if (item.kind === 'symbols') {
        const c = clamp(item.count, 1, 8)
        bits += c * Math.log2(SETS.symbols.length)
        preview.push(`!×${c}`)
      } else {
        preview.push(item.text || '（空）')
      }
    }
    return { bits, preview: preview.join('') }
  }, [recipe, wordPool.length])

  const activeEntropy =
    mode === 'classic' ? classicPoolInfo.bits : mode === 'passphrase' ? passInfo.bits : recipeInfo.bits

  const score = useMemo(() => strengthScore(pwd), [pwd])

  const filteredHistory = useMemo(() => {
    const q = histFilter.trim().toLowerCase()
    return history.filter(
      (h) =>
        h.score >= minScore &&
        (!q ||
          h.pwd.toLowerCase().includes(q) ||
          String(h.length).includes(q) ||
          h.mode.includes(q)),
    )
  }, [history, histFilter, minScore])

  const stats = useMemo(() => {
    if (!history.length) return { avgLen: 0, avgScore: '—', strong: 0, avgEnt: '—' }
    const avgLen = Math.round(history.reduce((s, h) => s + h.length, 0) / history.length)
    const avgScore = (history.reduce((s, h) => s + h.score, 0) / history.length).toFixed(1)
    const strong = history.filter((h) => h.score >= 4).length
    const avgEnt = Math.round(history.reduce((s, h) => s + (h.entropy || 0), 0) / history.length)
    return { avgLen, avgScore, strong, avgEnt: String(avgEnt) }
  }, [history])

  const safeLength = clamp(length, LENGTH_MIN, LENGTH_MAX)
  const safeBatch = clamp(batch, BATCH_MIN, BATCH_MAX)
  const canClassic = Object.values(opts).some(Boolean) || [...extraInclude].some((c) => !extraExclude.includes(c))
  const canGenerate = mode === 'classic' ? canClassic : mode === 'passphrase' ? wordPool.length >= 2 : recipe.length > 0

  function makeClassic(): string | null {
    const { pool, required } = charsetPool(opts, excludeAmbiguous, extraInclude, extraExclude)
    if (!pool) return null
    const out = [...required]
    while (out.length < safeLength) out.push(securePick(pool))
    if (out.length > safeLength) out.length = safeLength
    shuffleInPlace(out)
    return out.join('')
  }

  function makePassphrase(): string {
    const n = clamp(wordCount, WORD_COUNT_MIN, WORD_COUNT_MAX)
    const words: string[] = []
    for (let i = 0; i < n; i++) {
      let w = wordPool[secureIndex(wordPool.length)]!
      if (capitalizeWords) w = w.charAt(0).toUpperCase() + w.slice(1)
      words.push(w)
    }
    let out = words.join(separator)
    const d = clamp(passDigits, 0, 8)
    if (d > 0) {
      let digits = ''
      for (let i = 0; i < d; i++) digits += securePick(SETS.digits)
      out += separator + digits
    }
    if (passSymbol) out += securePick(SETS.symbols)
    return out
  }

  function makeRecipe(): string {
    const parts: string[] = []
    for (const item of recipe) {
      if (item.kind === 'word') {
        let w = wordPool[secureIndex(wordPool.length)]!
        if (capitalizeWords) w = w.charAt(0).toUpperCase() + w.slice(1)
        parts.push(w)
      } else if (item.kind === 'digits') {
        const c = clamp(item.count, 1, 12)
        let s = ''
        for (let i = 0; i < c; i++) s += securePick(SETS.digits)
        parts.push(s)
      } else if (item.kind === 'symbols') {
        const c = clamp(item.count, 1, 8)
        let s = ''
        for (let i = 0; i < c; i++) s += securePick(SETS.symbols)
        parts.push(s)
      } else {
        parts.push(item.text)
      }
    }
    return parts.join('')
  }

  function makeOne(): string | null {
    if (mode === 'classic') return makeClassic()
    if (mode === 'passphrase') return makePassphrase()
    return makeRecipe()
  }

  function generate() {
    if (!canGenerate) return
    const results: string[] = []
    for (let i = 0; i < safeBatch; i++) {
      const r = makeOne()
      if (r) results.push(r)
    }
    if (!results.length) return
    setPwd(results[0]!)
    setBatchList(results)
    setCopied(null)
    if (!saveHistory) return
    setHistory((h) =>
      [
        ...results.map((p) => ({
          id: uid('pw'),
          pwd: p,
          at: Date.now(),
          length: p.length,
          score: strengthScore(p),
          mode,
          entropy: Math.round(activeEntropy),
        })),
        ...h,
      ].slice(0, HISTORY_CAP),
    )
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setMode('classic')
    setLength(clamp(p.length, LENGTH_MIN, LENGTH_MAX))
    setOpts(p.opts)
    setExcludeAmbiguous(p.excludeAmbiguous)
  }

  function applyRecipeStyle(style: (typeof RECIPE_STYLES)[number]) {
    setMode('recipe')
    setRecipe(style.items.map((item) => ({ ...item, id: uid('ing') })))
  }

  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    setRecipe((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const modeLabel = mode === 'classic' ? '字元集' : mode === 'passphrase' ? '通行片語' : '成分配方'

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row pw-shell-actions">
          <ActionButton className="btn sm accent" onClick={generate} disabled={!canGenerate}>
            產生
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!batchList.length}
            onClick={() => downloadText('passwords.txt', batchList.join('\n'))}
          >
            匯出批次
          </ActionButton>
        </div>
      }
    >
      <div className="pw-calc">
        <div className="pw-stats">
          <span className="metric">歷史 {history.length}</span>
          <span className="tag">平均長度 {stats.avgLen || '—'}</span>
          <span className="tag">平均強度 {stats.avgScore}</span>
          <span className="tag">強以上 {stats.strong}</span>
          <span className="tag">平均熵 {stats.avgEnt} bit</span>
        </div>

        <div className="pw-mode-tabs" role="tablist">
          {(
            [
              ['classic', '字元集'],
              ['passphrase', '通行片語'],
              ['recipe', '成分配方'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`btn sm ${mode === id ? 'accent' : 'ghost'}`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="panel pw-result">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">產生結果</h3>
            <span className="tag">{modeLabel}</span>
          </div>

          {pwd ? (
            <div className="pw-hero">
              <p className="muted pw-hero-label">目前密碼</p>
              <div className="pw-hero-pwd mono">{pwd}</div>
              <div className="progress pw-progress">
                <span style={{ width: `${(score / 5) * 100}%` }} />
              </div>
              <p className="muted pw-hero-meta">
                強度 {STRENGTH[score]} · 長度 {pwd.length} · 熵約 {formatEntropy(activeEntropy)}
              </p>
            </div>
          ) : (
            <div className="pw-hero pw-hero-empty">
              <p className="pw-hero-empty-title">尚未產生密碼</p>
              <p className="muted">調整下方設定後，按產生即可</p>
            </div>
          )}

          <div className="pw-actions">
            <ActionButton className="btn accent pw-gen-btn" onClick={generate} disabled={!canGenerate}>
              {pwd ? '再產生' : '產生密碼'}
            </ActionButton>
            <ActionButton
              className="btn ghost"
              disabled={!pwd}
              onClick={async () => {
                await copyText(pwd)
                setCopied('one')
                window.setTimeout(() => setCopied(null), 1500)
              }}
              icon="copy"
            >
              {copied === 'one' ? '已複製' : '複製'}
            </ActionButton>
            <ActionButton
              className="btn ghost"
              disabled={batchList.length < 2}
              onClick={async () => {
                await copyText(batchList.join('\n'))
                setCopied('all')
                window.setTimeout(() => setCopied(null), 1500)
              }}
              icon="copy"
            >
              {copied === 'all' ? '已複製全部' : '複製全部'}
            </ActionButton>
            <ActionButton
              className="btn ghost"
              disabled={!batchList.length}
              onClick={() => downloadText('passwords.txt', batchList.join('\n'))}
            >
              匯出批次
            </ActionButton>
          </div>

          {batchList.length > 1 && (
            <div className="pw-batch">
              <div className="label">本批共 {batchList.length} 組</div>
              <ul className="pw-batch-list">
                {batchList.map((p, i) => (
                  <li key={`${i}-${p}`} className={`pw-batch-item${p === pwd ? ' is-active' : ''}`}>
                    <button type="button" className="pw-batch-pick" onClick={() => setPwd(p)}>
                      <code className="mono">{p}</code>
                    </button>
                    <span className="tag">{STRENGTH[strengthScore(p)]}</span>
                    <ActionButton
                      className="btn ghost sm"
                      onClick={() => void copyText(p)}
                      icon="copy"
                      iconOnly
                      tooltip="複製"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="muted pw-disclaimer">僅本機 Web Crypto 亂數；請勿長期明文留存真實重要帳號密碼</p>
        </section>

        <div className="pw-main">
          <section className="panel pw-settings">
            <h3 className="pw-panel-title">產生設定 · {modeLabel}</h3>

            {mode === 'classic' && (
              <>
                <div className="pw-block">
                  <div className="label">預設風格</div>
                  <div className="pw-chips">
                    {PRESETS.map((p) => (
                      <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="stack">
                  <span className="label">
                    長度：{safeLength}（{LENGTH_MIN}–{LENGTH_MAX}）
                  </span>
                  <input
                    className="field"
                    type="range"
                    min={LENGTH_MIN}
                    max={LENGTH_MAX}
                    value={safeLength}
                    onChange={(e) => setLength(clamp(parseNumber(e.target.value, LENGTH_MIN), LENGTH_MIN, LENGTH_MAX))}
                  />
                  <input
                    className="field"
                    type="number"
                    min={LENGTH_MIN}
                    max={LENGTH_MAX}
                    value={safeLength}
                    onChange={(e) => {
                      const n = parseNumber(e.target.value)
                      if (!Number.isFinite(n)) return
                      setLength(clamp(n, LENGTH_MIN, LENGTH_MAX))
                    }}
                  />
                </label>

                <div className="pw-block">
                  <div className="label">字元成分</div>
                  <div className="pw-chips">
                    {(
                      [
                        ['lower', '小寫'],
                        ['upper', '大寫'],
                        ['digits', '數字'],
                        ['symbols', '符號'],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className={`pw-check-chip${opts[k] ? ' is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={opts[k]}
                          onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {!canClassic && <p className="field-error">請至少勾選一種字元類型或加入自訂字元</p>}
                </div>

                <label className="pw-check">
                  <input
                    type="checkbox"
                    checked={excludeAmbiguous}
                    onChange={() => setExcludeAmbiguous(!excludeAmbiguous)}
                  />
                  <span>排除易混淆（0 O I l 1）</span>
                </label>

                <div className="pw-fields-2">
                  <label className="stack">
                    <span className="label">額外納入字元</span>
                    <input
                      className="field mono"
                      value={extraInclude}
                      maxLength={CUSTOM_SET_MAX}
                      placeholder="例：¥€_"
                      onChange={(e) => setExtraInclude(limitText(e.target.value, CUSTOM_SET_MAX))}
                    />
                  </label>
                  <label className="stack">
                    <span className="label">額外排除字元</span>
                    <input
                      className="field mono"
                      value={extraExclude}
                      maxLength={CUSTOM_SET_MAX}
                      placeholder="例：@#"
                      onChange={(e) => setExtraExclude(limitText(e.target.value, CUSTOM_SET_MAX))}
                    />
                  </label>
                </div>
              </>
            )}

            {mode === 'passphrase' && (
              <>
                <p className="muted pw-hint">用隨機詞彙組成好記片語，可再加數字／符號調味</p>
                <label className="stack">
                  <span className="label">
                    詞彙數：{clamp(wordCount, WORD_COUNT_MIN, WORD_COUNT_MAX)}（{WORD_COUNT_MIN}–{WORD_COUNT_MAX}）
                  </span>
                  <input
                    className="field"
                    type="range"
                    min={WORD_COUNT_MIN}
                    max={WORD_COUNT_MAX}
                    value={clamp(wordCount, WORD_COUNT_MIN, WORD_COUNT_MAX)}
                    onChange={(e) =>
                      setWordCount(clamp(parseNumber(e.target.value, WORD_COUNT_MIN), WORD_COUNT_MIN, WORD_COUNT_MAX))
                    }
                  />
                </label>
                <div className="pw-fields-2">
                  <label className="stack">
                    <span className="label">分隔符號</span>
                    <input
                      className="field mono"
                      value={separator}
                      maxLength={3}
                      onChange={(e) => setSeparator(limitText(e.target.value, 3))}
                    />
                  </label>
                  <label className="stack">
                    <span className="label">尾端數字位數</span>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      max={8}
                      value={clamp(passDigits, 0, 8)}
                      onChange={(e) => setPassDigits(clamp(parseNumber(e.target.value, 0), 0, 8))}
                    />
                  </label>
                </div>
                <label className="pw-check">
                  <input type="checkbox" checked={capitalizeWords} onChange={() => setCapitalizeWords(!capitalizeWords)} />
                  <span>詞首大寫</span>
                </label>
                <label className="pw-check">
                  <input type="checkbox" checked={passSymbol} onChange={() => setPassSymbol(!passSymbol)} />
                  <span>尾端加一個符號</span>
                </label>
                <label className="stack">
                  <span className="label">自訂詞庫（空白／逗號分隔，≥8 個才啟用）</span>
                  <textarea
                    className="field mono pw-textarea"
                    rows={4}
                    value={customWordsRaw}
                    maxLength={CUSTOM_WORDS_MAX}
                    placeholder="例：coffee, mountain, river, ...（留空用內建英文詞庫）"
                    onChange={(e) => setCustomWordsRaw(limitText(e.target.value, CUSTOM_WORDS_MAX))}
                  />
                  <p className="field-hint">
                    目前詞庫 {wordPool.length} 詞 · {usingCustomWords ? '自訂' : '內建英文'}
                  </p>
                </label>
              </>
            )}

            {mode === 'recipe' && (
              <>
                <p className="muted pw-hint">像食譜一樣排列成分：詞彙、數字、符號、固定文字，輸入後再產生</p>
                <div className="pw-block">
                  <div className="label">風格模板（一鍵套用）</div>
                  <div className="pw-chips">
                    {RECIPE_STYLES.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="btn sm ghost"
                        title={s.hint}
                        onClick={() => applyRecipeStyle(s)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ul className="pw-recipe-list">
                  {recipe.map((item, idx) => (
                    <li key={item.id} className="pw-recipe-row">
                      <span className="muted pw-recipe-idx">{idx + 1}</span>
                      <div className="pw-recipe-controls">
                        <select
                          className="field field-select-xs pw-recipe-kind"
                          value={item.kind}
                          onChange={(e) =>
                            updateIngredient(item.id, {
                              kind: e.target.value as IngredientKind,
                              text: e.target.value === 'custom' ? item.text || '-' : '',
                              count:
                                e.target.value === 'digits'
                                  ? 4
                                  : e.target.value === 'symbols'
                                    ? 1
                                    : 1,
                            })
                          }
                        >
                          <option value="word">隨機詞</option>
                          <option value="digits">數字</option>
                          <option value="symbols">符號</option>
                          <option value="custom">固定文字</option>
                        </select>
                        {item.kind === 'custom' ? (
                          <input
                            className="field mono pw-recipe-value"
                            value={item.text}
                            maxLength={24}
                            placeholder="固定字串"
                            onChange={(e) => updateIngredient(item.id, { text: limitText(e.target.value, 24) })}
                          />
                        ) : item.kind === 'word' ? (
                          <span className="pw-recipe-note">從詞庫抽 1 詞</span>
                        ) : (
                          <input
                            className="field pw-recipe-value"
                            type="number"
                            min={1}
                            max={item.kind === 'digits' ? 12 : 8}
                            value={clamp(item.count, 1, item.kind === 'digits' ? 12 : 8)}
                            onChange={(e) =>
                              updateIngredient(item.id, {
                                count: clamp(parseNumber(e.target.value, 1), 1, item.kind === 'digits' ? 12 : 8),
                              })
                            }
                          />
                        )}
                      </div>
                      <DeleteButton
                        disabled={recipe.length <= 1}
                        onClick={() => setRecipe((xs) => xs.filter((x) => x.id !== item.id))}
                        label="移除成分"
                      />
                    </li>
                  ))}
                </ul>

                <div className="pw-chips">
                  <ActionButton className="btn sm ghost" onClick={() => setRecipe((xs) => [...xs, newIngredient('word')])}>
                    ＋詞彙
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => setRecipe((xs) => [...xs, newIngredient('digits')])}
                  >
                    ＋數字
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => setRecipe((xs) => [...xs, newIngredient('symbols')])}
                  >
                    ＋符號
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => setRecipe((xs) => [...xs, newIngredient('custom')])}
                  >
                    ＋固定文字
                  </ActionButton>
                </div>

                <label className="pw-check">
                  <input type="checkbox" checked={capitalizeWords} onChange={() => setCapitalizeWords(!capitalizeWords)} />
                  <span>詞彙首字大寫</span>
                </label>

                <label className="stack">
                  <span className="label">自訂詞庫（與通行片語共用）</span>
                  <textarea
                    className="field mono pw-textarea"
                    rows={3}
                    value={customWordsRaw}
                    maxLength={CUSTOM_WORDS_MAX}
                    placeholder="留空用內建；≥8 詞啟用自訂"
                    onChange={(e) => setCustomWordsRaw(limitText(e.target.value, CUSTOM_WORDS_MAX))}
                  />
                </label>

                <p className="field-hint">預覽結構：{recipeInfo.preview || '—'}</p>
              </>
            )}

            <label className="stack">
              <span className="label">
                一次產生數量：{safeBatch}（{BATCH_MIN}–{BATCH_MAX}）
              </span>
              <input
                className="field"
                type="range"
                min={BATCH_MIN}
                max={BATCH_MAX}
                value={safeBatch}
                onChange={(e) => setBatch(clamp(parseNumber(e.target.value, BATCH_MIN), BATCH_MIN, BATCH_MAX))}
              />
            </label>

            <label className="pw-check">
              <input type="checkbox" checked={saveHistory} onChange={() => setSaveHistory(!saveHistory)} />
              <span>儲存產生歷史（明文，不建議用於真實密碼）</span>
            </label>
          </section>

          <section className="panel pw-info">
            <h3 className="pw-panel-title">更多資訊</h3>
            <ul className="pw-info-list">
              {mode === 'classic' && (
                <>
                  <li>
                    <span className="muted">字元池大小</span>
                    <strong>{classicPoolInfo.size}</strong>
                  </li>
                  <li>
                    <span className="muted">估計熵</span>
                    <strong>{formatEntropy(classicPoolInfo.bits)}</strong>
                  </li>
                </>
              )}
              {mode === 'passphrase' && (
                <>
                  <li>
                    <span className="muted">詞庫大小</span>
                    <strong>{passInfo.words}</strong>
                  </li>
                  <li>
                    <span className="muted">估計熵</span>
                    <strong>{formatEntropy(passInfo.bits)}</strong>
                  </li>
                </>
              )}
              {mode === 'recipe' && (
                <>
                  <li>
                    <span className="muted">成分數</span>
                    <strong>{recipe.length}</strong>
                  </li>
                  <li>
                    <span className="muted">結構預覽</span>
                    <strong className="mono">{recipeInfo.preview || '—'}</strong>
                  </li>
                  <li>
                    <span className="muted">估計熵</span>
                    <strong>{formatEntropy(recipeInfo.bits)}</strong>
                  </li>
                </>
              )}
              <li>
                <span className="muted">暴力猜測粗估（10⁹/秒）</span>
                <strong>{crackHint(activeEntropy)}</strong>
              </li>
              <li>
                <span className="muted">亂數來源</span>
                <strong>crypto.getRandomValues</strong>
              </li>
            </ul>
            <p className="muted pw-hint">
              熵為理想均勻抽樣的理論值；真實強度還受詞庫品質、政策限制與是否重用影響。
            </p>
          </section>
        </div>

        <section className="panel pw-history">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">產生歷史</h3>
            <ActionButton
              className="btn sm ghost"
              disabled={!history.length}
              onClick={() => {
                if (confirm('確定清空全部歷史？')) setHistory([])
              }}
            >
              清空
            </ActionButton>
          </div>
          <input
            className="field"
            placeholder="篩選密碼／模式／長度…"
            value={histFilter}
            maxLength={80}
            onChange={(e) => setHistFilter(limitText(e.target.value, 80))}
          />
          <label className="stack">
            <span className="label">最低強度：{STRENGTH[minScore]}</span>
            <input
              className="field"
              type="range"
              min={0}
              max={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </label>
          {!filteredHistory.length && (
            <p className="muted" style={{ margin: 0 }}>
              尚無紀錄或不符合篩選（需勾選「儲存產生歷史」）
            </p>
          )}
          <ul className="pw-history-list">
            {filteredHistory.map((h) => (
              <li key={h.id} className="pw-history-card">
                <code className="mono pw-history-pwd">{h.pwd}</code>
                <div className="pw-history-meta">
                  <span className="tag">{STRENGTH[h.score]}</span>
                  <span className="tag">
                    {h.mode === 'classic' ? '字元集' : h.mode === 'passphrase' ? '片語' : '配方'}
                  </span>
                  <span className="tag">{h.length} 字</span>
                  {h.entropy > 0 && <span className="tag">~{h.entropy} bit</span>}
                </div>
                <div className="muted pw-history-time">{new Date(h.at).toLocaleString('zh-TW')}</div>
                <div className="pw-history-actions">
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setPwd(h.pwd)
                      setBatchList([h.pwd])
                    }}
                    icon="check"
                  >
                    顯示
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyText(h.pwd)}
                    icon="copy"
                    iconOnly
                    tooltip="複製"
                  />
                  <DeleteButton
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                    label="刪除"
                  />
                </div>
              </li>
            ))}
          </ul>
          {!!history.length && (
            <ActionButton
              className="btn ghost sm"
              onClick={() => downloadText('password-history.txt', history.map((x) => x.pwd).join('\n'))}
            >
              匯出歷史
            </ActionButton>
          )}
        </section>
      </div>
    </ProjectShell>
  )
}
