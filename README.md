# Mini Project Lab

同一個 React 專案裡，放多個獨立小專案（各自一個 route），左側導覽 + 上方搜尋，方便瀏覽與維護。目前數量以 `src/projects/registry.ts` 為準。

## 快速開始

```bash
npm install
npm run dev
```

建置：

```bash
npm run build
```

## 給 Cursor 的架構（新增／修改超直覺）

```
src/
  components/          Layout、Sidebar、ProjectShell
  pages/HomePage.tsx   導覽總覽頁
  lib/                 useLocalStorage、utils
  projects/
    registry.ts        ★ 專案 metadata 單一真相來源（標題、分層、描述）
    <slug>/index.tsx   ★ 每個小專案一個資料夾／一個預設匯出元件
  App.tsx              import.meta.glob 自動掛載 /p/:slug
  styles/global.css    設計系統
```

### 新增專案（三步）

1. 在 `src/projects/registry.ts` 加一筆  
2. 建立 `src/projects/<slug>/index.tsx`  
3. 完成 — 路由、側欄、首頁卡片會自動出現

### 專案頁模板

```tsx
import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'

const meta = getProject('your-slug')!

export default function Page() {
  return (
    <ProjectShell meta={meta}>
      {/* 使用 panel / stack / row / field / btn 等全域 class */}
    </ProjectShell>
  )
}
```

## 分層

| 層級 | 說明 |
|------|------|
| 實用小工具 | 轉換、計時、產生器 |
| 日常應用 | 筆記、追蹤、清單 |
| 產品原型 | AI、儀表板、建構器 |
| 進階 Demo | 監控、分析、即時互動 |

- 資料預設存在 `localStorage`（key 前綴 `lab:`）
- AI 類為本機啟發式／模板產生（不需 API Key）
- 部分專案會打公開 API（GitHub、匯率、加密貨幣等）

## Tech

- React 19 + TypeScript + Vite 6
- React Router
- `qrcode.react`、`uuid`（部分工具用）
