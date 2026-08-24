export type Tier = 'quick' | 'feature' | 'product' | 'portfolio'

export type ProjectMeta = {
  slug: string
  title: string
  description: string
  tier: Tier
  effort: string
  tags: string[]
}

export const projects: ProjectMeta[] = [
  // ── 超快型 ──
  { slug: 'todo-list', title: 'Todo List', description: '快速新增、完成與清除待辦事項。', tier: 'quick', effort: '幾小時～1 天', tags: ['productivity'] },
  { slug: 'pomodoro', title: 'Pomodoro 番茄鐘', description: '25/5 專注循環，含階段提示與計數。', tier: 'quick', effort: '幾小時～1 天', tags: ['timer'] },
  { slug: 'countdown', title: '倒數計時器', description: '自訂目標時間，倒數結束提醒。', tier: 'quick', effort: '幾小時～1 天', tags: ['timer'] },
  { slug: 'stopwatch', title: '秒錶', description: '開始、暫停、重置與單圈紀錄。', tier: 'quick', effort: '幾小時～1 天', tags: ['timer'] },
  { slug: 'bmi-calculator', title: 'BMI Calculator', description: '依身高體重計算 BMI 與分類。', tier: 'quick', effort: '幾小時～1 天', tags: ['health'] },
  { slug: 'currency-converter', title: '貨幣轉換器', description: '常用貨幣即時換算（示範匯率）。', tier: 'quick', effort: '幾小時～1 天', tags: ['finance'] },
  { slug: 'unit-converter', title: '單位轉換器', description: '長度、重量、溫度快速轉換。', tier: 'quick', effort: '幾小時～1 天', tags: ['utility'] },
  { slug: 'age-calculator', title: '年齡計算器', description: '國曆歲數、農曆對照、生肖星座與下次生日倒數。', tier: 'quick', effort: '幾小時～1 天', tags: ['utility'] },
  { slug: 'tip-calculator', title: 'Tip Calculator', description: '小費、分帳與每人應付金額。', tier: 'quick', effort: '幾小時～1 天', tags: ['finance'] },
  { slug: 'password-generator', title: '隨機密碼產生器', description: '可調長度與字元集的安全密碼。', tier: 'quick', effort: '幾小時～1 天', tags: ['security'] },
  { slug: 'qr-generator', title: 'QR Code Generator', description: '文字／URL 一鍵產生 QR Code。', tier: 'quick', effort: '幾小時～1 天', tags: ['utility'] },
  { slug: 'uuid-generator', title: 'UUID Generator', description: '批次產生 UUID v4。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'lorem-ipsum', title: 'Lorem Ipsum Generator', description: '產生佔位段落文字。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'random-name', title: 'Random Name Generator', description: '隨機英文姓名組合。', tier: 'quick', effort: '幾小時～1 天', tags: ['utility'] },
  { slug: 'random-number', title: 'Random Number Generator', description: '指定範圍產生亂數。', tier: 'quick', effort: '幾小時～1 天', tags: ['utility'] },
  { slug: 'color-converter', title: '色碼轉換器', description: '挑選顏色並顯示 HEX／RGB。', tier: 'quick', effort: '幾小時～1 天', tags: ['design'] },
  { slug: 'hex-rgb-hsl', title: 'HEX / RGB / HSL Converter', description: '三種色碼格式雙向轉換。', tier: 'quick', effort: '幾小時～1 天', tags: ['design'] },
  { slug: 'markdown-previewer', title: 'Markdown Previewer', description: '即時預覽 Markdown 內容。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'json-formatter', title: 'JSON Formatter', description: '格式化、壓縮與驗證 JSON。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'json-to-csv', title: 'JSON → CSV Converter', description: '物件陣列轉 CSV 並下載。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'base64', title: 'Base64 Encoder / Decoder', description: '文字與 Base64 互轉。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'url-codec', title: 'URL Encoder / Decoder', description: 'URL encode／decode 工具。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'timestamp', title: 'Timestamp Converter', description: 'Unix 時間戳與日期互轉。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'cron-generator', title: 'Cron Expression Generator', description: '視覺化組裝 cron 表達式。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },
  { slug: 'regex-tester', title: 'Regex Tester', description: '即時測試正規表達式匹配。', tier: 'quick', effort: '幾小時～1 天', tags: ['dev'] },

  // ── 功能型 ──
  { slug: 'weather-dashboard', title: '天氣 Dashboard', description: '示範城市天氣儀表板。', tier: 'feature', effort: '1～3 天', tags: ['dashboard'] },
  { slug: 'github-profile', title: 'GitHub Profile Viewer', description: '輸入帳號查看公開個人檔。', tier: 'feature', effort: '1～3 天', tags: ['github'] },
  { slug: 'github-repo-search', title: 'GitHub Repo Search', description: '搜尋公開儲存庫。', tier: 'feature', effort: '1～3 天', tags: ['github'] },
  { slug: 'ip-lookup', title: 'IP Address Lookup', description: '查詢 IP／本機網路資訊。', tier: 'feature', effort: '1～3 天', tags: ['network'] },
  { slug: 'url-shortener', title: 'URL Shortener', description: '本機短網址對照與複製。', tier: 'feature', effort: '1～3 天', tags: ['utility'] },
  { slug: 'qr-scanner', title: 'QR Code Scanner', description: '貼上／輸入內容解析 QR 文字。', tier: 'feature', effort: '1～3 天', tags: ['utility'] },
  { slug: 'clipboard-manager', title: 'Clipboard Manager', description: '本機剪貼簿歷史紀錄。', tier: 'feature', effort: '1～3 天', tags: ['productivity'] },
  { slug: 'bookmark-manager', title: 'Browser Bookmark Manager', description: '分類管理常用書籤。', tier: 'feature', effort: '1～3 天', tags: ['productivity'] },
  { slug: 'notes-app', title: '簡易筆記 App', description: '建立、編輯、刪除純文字筆記。', tier: 'feature', effort: '1～3 天', tags: ['notes'] },
  { slug: 'markdown-notes', title: 'Markdown 筆記 App', description: 'Markdown 筆記與即時預覽。', tier: 'feature', effort: '1～3 天', tags: ['notes'] },
  { slug: 'kanban-board', title: 'Kanban Board', description: '三欄看板拖曳狀態管理。', tier: 'feature', effort: '1～3 天', tags: ['productivity'] },
  { slug: 'habit-tracker', title: 'Habit Tracker', description: '追蹤每日習慣打卡。', tier: 'feature', effort: '1～3 天', tags: ['health'] },
  { slug: 'expense-tracker', title: 'Expense Tracker', description: '記錄支出並看分類總計。', tier: 'feature', effort: '1～3 天', tags: ['finance'] },
  { slug: 'accounting-app', title: '簡易記帳 App', description: '收支雙向記帳與結餘。', tier: 'feature', effort: '1～3 天', tags: ['finance'] },
  { slug: 'workout-tracker', title: 'Workout Tracker', description: '記錄訓練組數與重量。', tier: 'feature', effort: '1～3 天', tags: ['health'] },
  { slug: 'reading-tracker', title: 'Reading Tracker', description: '追蹤閱讀進度與書單。', tier: 'feature', effort: '1～3 天', tags: ['lifestyle'] },
  { slug: 'movie-watchlist', title: 'Movie Watchlist', description: '想看／已看電影清單。', tier: 'feature', effort: '1～3 天', tags: ['lifestyle'] },
  { slug: 'book-tracker', title: 'Book Tracker', description: '書本狀態與評分管理。', tier: 'feature', effort: '1～3 天', tags: ['lifestyle'] },
  { slug: 'recipe-manager', title: 'Recipe Manager', description: '收藏食譜與食材清單。', tier: 'feature', effort: '1～3 天', tags: ['lifestyle'] },
  { slug: 'shopping-list', title: 'Shopping List', description: '購物清單勾選與分類。', tier: 'feature', effort: '1～3 天', tags: ['lifestyle'] },
  { slug: 'packing-list', title: 'Packing List Generator', description: '依旅程類型產生打包清單。', tier: 'feature', effort: '1～3 天', tags: ['travel'] },
  { slug: 'event-countdown', title: 'Event Countdown', description: '重要活動倒數牆。', tier: 'feature', effort: '1～3 天', tags: ['calendar'] },
  { slug: 'birthday-reminder', title: 'Birthday Reminder', description: '生日提醒與即將到來列表。', tier: 'feature', effort: '1～3 天', tags: ['calendar'] },
  { slug: 'flashcard-app', title: 'Flashcard App', description: '正反面單字卡複習。', tier: 'feature', effort: '1～3 天', tags: ['learn'] },
  { slug: 'quiz-app', title: 'Quiz App', description: '多選測驗與計分。', tier: 'feature', effort: '1～3 天', tags: ['learn'] },

  // ── 產品型 ──
  { slug: 'ai-chat-ui', title: 'AI Chat UI', description: '對話介面（本機智慧回覆示範）。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-email', title: 'AI Email Generator', description: '依語氣產生商務郵件草稿。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-meeting', title: 'AI Meeting Summarizer', description: '會議筆記摘要與待辦抽取。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-rewriter', title: 'AI Text Rewriter', description: '改寫文字風格與長度。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-resume-review', title: 'AI Resume Reviewer', description: '履歷文字健檢建議。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-pdf-qa', title: 'AI PDF Q&A', description: '貼上文件內容後問答。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-caption', title: 'AI Image Caption Generator', description: '依關鍵字產生圖片說明。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-tweet', title: 'AI Tweet Generator', description: '產生短貼文變體。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-study-planner', title: 'AI Study Planner', description: '依科目時數產出讀書計畫。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'ai-flashcard-gen', title: 'AI Flashcard Generator', description: '從筆記自動抽出閃卡。', tier: 'product', effort: '3～7 天', tags: ['ai'] },
  { slug: 'finance-dashboard', title: 'Personal Finance Dashboard', description: '收支儀表與預算概覽。', tier: 'product', effort: '3～7 天', tags: ['finance'] },
  { slug: 'crypto-dashboard', title: 'Crypto Price Dashboard', description: '加密貨幣價格示範看板。', tier: 'product', effort: '3～7 天', tags: ['finance'] },
  { slug: 'stock-watchlist', title: 'Stock Watchlist', description: '股票觀察清單與漲跌。', tier: 'product', effort: '3～7 天', tags: ['finance'] },
  { slug: 'rss-reader', title: 'RSS Reader', description: '本機 RSS／訂閱閱讀器。', tier: 'product', effort: '3～7 天', tags: ['content'] },
  { slug: 'newsletter-reader', title: 'Newsletter Reader', description: '電子報歸檔閱讀介面。', tier: 'product', effort: '3～7 天', tags: ['content'] },
  { slug: 'personal-dashboard', title: 'Personal Dashboard', description: '個人今日總覽小工具牆。', tier: 'product', effort: '3～7 天', tags: ['dashboard'] },
  { slug: 'personal-crm', title: 'Personal CRM', description: '人脈與跟進紀錄。', tier: 'product', effort: '3～7 天', tags: ['crm'] },
  { slug: 'project-management', title: 'Simple Project Management', description: '專案任務與進度管理。', tier: 'product', effort: '3～7 天', tags: ['productivity'] },
  { slug: 'invoice-generator', title: 'Freelancer Invoice Generator', description: '產生與下載發票內容。', tier: 'product', effort: '3～7 天', tags: ['finance'] },
  { slug: 'portfolio-builder', title: 'Online Portfolio Builder', description: '線上作品集編輯預覽。', tier: 'product', effort: '3～7 天', tags: ['builder'] },
  { slug: 'resume-builder', title: 'Resume Builder', description: '結構化履歷編輯器。', tier: 'product', effort: '3～7 天', tags: ['builder'] },
  { slug: 'link-in-bio', title: 'Link-in-Bio Page Builder', description: '個人連結頁產生器。', tier: 'product', effort: '3～7 天', tags: ['builder'] },
  { slug: 'form-builder', title: 'Form Builder', description: '拖放式表單欄位組裝。', tier: 'product', effort: '3～7 天', tags: ['builder'] },
  { slug: 'survey-app', title: 'Survey App', description: '問卷建立與回覆統計。', tier: 'product', effort: '3～7 天', tags: ['builder'] },
  { slug: 'anonymous-feedback', title: 'Anonymous Feedback App', description: '匿名回饋收集板。', tier: 'product', effort: '3～7 天', tags: ['feedback'] },

  // ── 作品集 ──
  { slug: 'screenshot-html', title: 'Screenshot → HTML Generator', description: '描述畫面結構產出 HTML。', tier: 'portfolio', effort: '1～2 週', tags: ['dev'] },
  { slug: 'website-screenshot', title: 'Website Screenshot Tool', description: '網址預覽卡／截圖佔位工具。', tier: 'portfolio', effort: '1～2 週', tags: ['dev'] },
  { slug: 'uptime-monitor', title: 'Website Uptime Monitor', description: '網站狀態監控示範。', tier: 'portfolio', effort: '1～2 週', tags: ['ops'] },
  { slug: 'api-monitor', title: 'API Monitoring Dashboard', description: 'API 延遲與可用性看板。', tier: 'portfolio', effort: '1～2 週', tags: ['ops'] },
  { slug: 'webhook-tester', title: 'Webhook Tester', description: '模擬接收 webhook payload。', tier: 'portfolio', effort: '1～2 週', tags: ['dev'] },
  { slug: 'api-docs-gen', title: 'API Documentation Generator', description: '從 endpoint 定義產生文件。', tier: 'portfolio', effort: '1～2 週', tags: ['dev'] },
  { slug: 'db-schema-viz', title: 'Database Schema Visualizer', description: '表格關聯視覺化。', tier: 'portfolio', effort: '1～2 週', tags: ['data'] },
  { slug: 'sql-playground', title: 'SQL Query Playground', description: '記憶體資料表 SQL 練習場。', tier: 'portfolio', effort: '1～2 週', tags: ['data'] },
  { slug: 'github-contrib', title: 'GitHub Contribution Analyzer', description: '貢獻熱度分析示範。', tier: 'portfolio', effort: '1～2 週', tags: ['github'] },
  { slug: 'readme-generator', title: 'GitHub README Generator', description: '互動產生 README 模板。', tier: 'portfolio', effort: '1～2 週', tags: ['github'] },
  { slug: 'dependency-dashboard', title: 'Dependency Update Dashboard', description: '套件版本與更新狀態。', tier: 'portfolio', effort: '1～2 週', tags: ['ops'] },
  { slug: 'docker-dashboard', title: 'Docker Container Dashboard', description: '容器狀態示範儀表板。', tier: 'portfolio', effort: '1～2 週', tags: ['ops'] },
  { slug: 'server-monitor', title: 'Server Monitoring Dashboard', description: 'CPU／記憶體監控示範。', tier: 'portfolio', effort: '1～2 週', tags: ['ops'] },
  { slug: 'log-viewer', title: 'Log Viewer', description: '日誌篩選與等級著色。', tier: 'portfolio', effort: '1～2 週', tags: ['ops'] },
  { slug: 'feature-flags', title: 'Feature Flag Dashboard', description: '功能開關管理面板。', tier: 'portfolio', effort: '1～2 週', tags: ['ops'] },
  { slug: 'simple-analytics', title: 'Simple Analytics', description: '簡易流量與事件分析。', tier: 'portfolio', effort: '1～2 週', tags: ['analytics'] },
  { slug: 'heatmap-analytics', title: 'Heatmap Analytics', description: '點擊熱區視覺化。', tier: 'portfolio', effort: '1～2 週', tags: ['analytics'] },
  { slug: 'ab-testing', title: 'A/B Testing Tool', description: '變體分配與轉換率比較。', tier: 'portfolio', effort: '1～2 週', tags: ['analytics'] },
  { slug: 'passwordless-login', title: 'Passwordless Login Demo', description: '魔法連結登入流程示範。', tier: 'portfolio', effort: '1～2 週', tags: ['auth'] },
  { slug: 'oauth-playground', title: 'OAuth Playground', description: 'OAuth 授權流程教學沙盒。', tier: 'portfolio', effort: '1～2 週', tags: ['auth'] },
  { slug: 'realtime-chat', title: 'Real-time Chat App', description: '本機多房間即時聊天模擬。', tier: 'portfolio', effort: '1～2 週', tags: ['realtime'] },
  { slug: 'whiteboard', title: 'Collaborative Whiteboard', description: '畫布塗鴉白板。', tier: 'portfolio', effort: '1～2 週', tags: ['realtime'] },
  { slug: 'tic-tac-toe', title: 'Multiplayer Tic-Tac-Toe', description: '雙人／人機井字遊戲。', tier: 'portfolio', effort: '1～2 週', tags: ['game'] },
  { slug: 'code-editor', title: 'Browser-based Code Editor', description: '瀏覽器簡易程式編輯器。', tier: 'portfolio', effort: '1～2 週', tags: ['dev'] },
  { slug: 'saas-boilerplate', title: 'Mini SaaS Boilerplate', description: '迷你 SaaS 儀表板骨架。', tier: 'portfolio', effort: '1～2 週', tags: ['saas'] },
]

export const tiers: { id: Tier; label: string; blurb: string; color: string }[] = [
  { id: 'quick', label: '實用小工具', blurb: '轉換、計時、產生器', color: '#2a9d8f' },
  { id: 'feature', label: '日常應用', blurb: '筆記、追蹤、清單', color: '#e9a319' },
  { id: 'product', label: '產品原型', blurb: 'AI、儀表板、建構器', color: '#f0734a' },
  { id: 'portfolio', label: '進階 Demo', blurb: '監控、分析、即時互動', color: '#d6406a' },
]

export const tagLabels: Record<string, string> = {
  productivity: '生產力',
  timer: '計時',
  health: '健康',
  finance: '財務',
  utility: '工具',
  security: '安全',
  dev: '開發',
  design: '設計',
  dashboard: '儀表板',
  github: 'GitHub',
  network: '網路',
  notes: '筆記',
  lifestyle: '生活',
  travel: '旅行',
  calendar: '行程',
  learn: '學習',
  ai: 'AI',
  content: '內容',
  crm: 'CRM',
  builder: '建構器',
  feedback: '回饋',
  ops: '維運',
  data: '資料',
  analytics: '分析',
  auth: '登入',
  realtime: '即時',
  game: '遊戲',
  saas: 'SaaS',
}

export function allTags() {
  const set = new Set<string>()
  for (const p of projects) for (const t of p.tags) set.add(t)
  return [...set].sort((a, b) => (tagLabels[a] || a).localeCompare(tagLabels[b] || b, 'zh-Hant'))
}

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug)
}

export function projectsByTier(tier: Tier) {
  return projects.filter((p) => p.tier === tier)
}
