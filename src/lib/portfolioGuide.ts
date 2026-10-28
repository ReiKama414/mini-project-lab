import type { FeatureInfoItem } from '../components/FeatureLayout'

export type PortfolioSlug =
  | 'screenshot-html'
  | 'uptime-monitor'
  | 'api-monitor'
  | 'api-docs-gen'
  | 'db-schema-viz'
  | 'sql-playground'
  | 'readme-generator'
  | 'dependency-dashboard'
  | 'log-viewer'
  | 'feature-flags'
  | 'whiteboard'
  | 'tic-tac-toe'
  | 'code-editor'

type Faq = { title: string; body: string }

export type PortfolioGuide = {
  info: FeatureInfoItem[]
  faq: Faq[]
}

const baseInfo: FeatureInfoItem[] = [
  { label: '分類', value: '進階 Demo（portfolio）' },
  { label: '資料', value: '多數設定存本機；非多使用者後端' },
]

const baseFaq: Faq[] = [
  {
    title: '這是正式產品嗎？',
    body: '不是。進階 Demo 用來練 UI 與流程，沒有 SLA、帳號系統或 24/7 監控後台。',
  },
  {
    title: '和日常應用／實用小工具有何不同？',
    body: '日常應用偏重可重複使用的完整工具；進階 Demo 可能依公開 proxy 或示範資料，請以學習與原型為目的。',
  },
]

const guides: Record<PortfolioSlug, PortfolioGuide> = {
  'screenshot-html': {
    info: [
      ...baseInfo,
      { label: '輸出', value: '依結構描述產生 HTML 草稿' },
      { label: '限制', value: '非視覺截圖辨識，不連 AI 後端' },
    ],
    faq: [
      {
        title: '可以從真實截圖自動轉 HTML 嗎？',
        body: '目前僅依你填的版面描述與區塊清單組版，不會分析圖片像素。',
      },
      {
        title: '適合什麼情境？',
        body: '快速起稿 landing、wireframe 轉成可貼進專案的 HTML 骨架。',
      },
    ],
  },
  'uptime-monitor': {
    info: [
      ...baseInfo,
      { label: '探測方式', value: 'allorigins CORS proxy + HTTP 狀態碼' },
      { label: '儲存', value: '站點清單與檢查紀錄（localStorage）' },
    ],
    faq: [
      {
        title: '為什麼和真實 uptime 服務不同？',
        body: '瀏覽器無法對任意網域直連，需經第三方 proxy；延遲含代理往返，且代理故障會誤判。',
      },
      {
        title: '自動輪詢會一直跑嗎？',
        body: '僅在頁面開啟且勾選「自動輪詢」時每 60 秒檢查；關閉分頁即停止。',
      },
      {
        title: '成功率怎麼算？',
        body: '以本機保留的最近檢查紀錄計算，清除瀏覽器資料會重置。',
      },
    ],
  },
  'api-monitor': {
    info: [
      ...baseInfo,
      { label: '探測', value: '先 CORS 直連，失敗再走 allorigins' },
      { label: '指標', value: '延遲、成功／失敗、最近探測紀錄' },
    ],
    faq: [
      {
        title: '可以監控內網 API 嗎？',
        body: '不行。僅能檢查瀏覽器可達的公開 URL，且受 CORS 與 proxy 限制。',
      },
      {
        title: '歷史圖表準確嗎？',
        body: '延遲曲線僅供本頁參考，資料存本機，非長期時序資料庫。',
      },
    ],
  },
  'api-docs-gen': {
    info: [
      ...baseInfo,
      { label: '輸入', value: 'Endpoint 表格（方法、路徑、說明）' },
      { label: '輸出', value: 'Markdown／可複製 API 文件草稿' },
    ],
    faq: [
      {
        title: '會從程式碼自動解析嗎？',
        body: '不會。需手動填 endpoint；適合整理既有 API 或課堂作業。',
      },
      {
        title: 'OpenAPI 匯入？',
        body: '目前未支援；可將 OpenAPI 內容貼到相關欄位手動整理。',
      },
    ],
  },
  'db-schema-viz': {
    info: [
      ...baseInfo,
      { label: '資料來源', value: '本機表格／欄位／關聯定義' },
      { label: '視覺', value: 'ER 關聯示意（非 live DB）' },
    ],
    faq: [
      {
        title: '能連線 PostgreSQL 嗎？',
        body: '不能。僅視覺化你編輯的 schema 描述，不執行 SQL 或讀取遠端資料庫。',
      },
      {
        title: '匯出格式？',
        body: '可複製／下載示意用結構，供文件或教學使用。',
      },
    ],
  },
  'sql-playground': {
    info: [
      ...baseInfo,
      { label: '引擎', value: '記憶體內建範例表 + 簡易 SQL 執行' },
      { label: '用途', value: 'SELECT／JOIN 練習，非生產資料庫' },
    ],
    faq: [
      {
        title: '支援哪些 SQL？',
        body: '以教學常見的查詢為主；複雜 DDL、交易、權限等可能未實作。',
      },
      {
        title: '資料會上傳嗎？',
        body: '不會。表與查詢結果僅存在瀏覽器記憶體與 localStorage。',
      },
    ],
  },
  'readme-generator': {
    info: [
      ...baseInfo,
      { label: '輸出', value: 'GitHub 風格 README Markdown' },
      { label: '區塊', value: '徽章、安裝、功能、API、授權等可勾選' },
    ],
    faq: [
      {
        title: '會自動讀取我的 repo 嗎？',
        body: '不會。內容由表單產生，可複製到 GitHub 新檔或下載 .md。',
      },
      {
        title: '徽章連結正確嗎？',
        body: '依專案名稱產生 shields.io 範本，上線前請改成真實 repo 路徑。',
      },
    ],
  },
  'dependency-dashboard': {
    info: [
      ...baseInfo,
      { label: '資料', value: 'npm registry 公開元資料（有網路時）' },
      { label: '限制', value: '僅示範清單內套件，非掃描整個 monorepo' },
    ],
    faq: [
      {
        title: '和 Dependabot 一樣嗎？',
        body: '不是。僅查詢你加入的套件最新版與簡要狀態，不開 PR、不掃安全漏洞全文。',
      },
      {
        title: '查詢失敗？',
        body: 'registry 限流或網路問題時會顯示錯誤；可稍後重試。',
      },
    ],
  },
  'log-viewer': {
    info: [
      ...baseInfo,
      { label: '資料', value: '貼上／匯入文字或產生示範日誌' },
      { label: '功能', value: '等級篩選、關鍵字、著色、匯出' },
    ],
    faq: [
      {
        title: '能接真實伺服器 log stream 嗎？',
        body: '不能。需自行貼上或匯入檔案內容，適合除錯前處理與格式練習。',
      },
      {
        title: '大量日誌效能？',
        body: '極大檔案可能讓瀏覽器變慢，建議先篩選或切分後再貼上。',
      },
    ],
  },
  'feature-flags': {
    info: [
      ...baseInfo,
      { label: '模型', value: '開關 + 百分比 + 環境（dev/staging/prod）' },
      { label: '評估', value: '本機 user id 雜湊決定是否命中' },
    ],
    faq: [
      {
        title: '會同步到正式 LaunchDarkly 嗎？',
        body: '不會。僅本機 JSON 與評估邏輯示範，可匯出 flags 給其他系統參考。',
      },
      {
        title: '百分比 rollout 怎麼算？',
        body: '對 user id 與 flag key 做穩定雜湊，同一使用者結果一致，非真實流量分配。',
      },
    ],
  },
  whiteboard: {
    info: [
      ...baseInfo,
      { label: '全螢幕', value: '頂部或工具列「全螢幕繪圖」· Esc 退出' },
      { label: '匯出', value: 'PNG 下載 · 草稿最多 8 份（localStorage）' },
      { label: '復原', value: '每筆一層，最多保留 25 步' },
      { label: '模板', value: '格線／點陣／橫線會清空畫布後套用' },
    ],
    faq: [
      {
        title: '怎麼開始畫？',
        body: '選色 → 調粗細 → 在畫布拖曳。擦布會以紙色覆蓋；模板與清空會重置筆劃計數但可復原上一狀態（若尚未再畫新筆）。',
      },
      {
        title: '手機／平板怎麼畫？',
        body: '單指在畫布上拖曳；畫布區已關閉瀏覽器預設捲動。建議先按「全螢幕繪圖」取得較大區域。',
      },
      {
        title: '筆尖位置不準？',
        body: '進出全螢幕或旋轉螢幕後若偏移，再切換一次全螢幕或稍等 ResizeObserver 重算；仍異常可重整頁面。',
      },
      {
        title: '草稿與背景圖？',
        body: '「存草稿」把整張畫布存成 PNG 資料在本機；「匯入背景圖」會以 contain 鋪在畫布上再繼續畫。全螢幕時草稿列表與背景匯入會隱藏以專心繪圖。',
      },
      {
        title: '快捷鍵',
        body: 'Esc：退出全螢幕。Ctrl+Z（Mac：⌘Z）：復原上一筆。',
      },
      {
        title: '觸控筆／壓感？',
        body: '支援 Pointer Events；有壓感時筆跡粗細會略隨壓力變化（依裝置與瀏覽器）。',
      },
    ],
  },
  'tic-tac-toe': {
    info: [
      ...baseInfo,
      { label: '模式', value: '雙人同機或簡易人機' },
      { label: '連線', value: '無網路對戰' },
    ],
    faq: [
      {
        title: '人機難度？',
        body: '示範用 minimax 或 heuristics，非競賽級 AI。',
      },
      {
        title: '戰績會保存嗎？',
        body: '可選本機紀錄勝負；清除資料即消失。',
      },
    ],
  },
  'code-editor': {
    info: [
      ...baseInfo,
      { label: '預覽', value: 'HTML + CSS + JS iframe 即時預覽' },
      { label: '限制', value: '非 VS Code；程式僅在本機執行' },
    ],
    faq: [
      {
        title: '可以跑 npm 專案嗎？',
        body: '不行。僅單頁 snippet 預覽，無模組打包或 Node API。',
      },
      {
        title: '安全嗎？',
        body: '你輸入的 JS 在 sandbox iframe 執行，仍請勿貼不明惡意程式碼。',
      },
    ],
  },
}

export function getPortfolioGuide(slug: PortfolioSlug): PortfolioGuide {
  const g = guides[slug]
  return {
    info: g.info,
    faq: [...g.faq, ...baseFaq],
  }
}
