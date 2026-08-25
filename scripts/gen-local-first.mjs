/**
 * Generates local-first project pages (102–200) + registry snippet.
 * Run: node scripts/gen-local-first.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const projectsDir = path.join(root, 'src', 'projects')

const defs = [
  // Image
  ['batch-watermark', '批次浮水印', '一次為多張圖片套用文字浮水印。', 'feature', 'image'],
  ['pdf-watermark', 'PDF 浮水印', '為 PDF 每頁加上文字浮水印（本機）。', 'feature', 'pdf'],
  ['image-mosaic', '馬賽克遮蔽', '在圖片上塗抹馬賽克／模糊／色塊。', 'feature', 'image'],
  ['exif-cleaner', 'EXIF 清除器', '移除 GPS 與拍攝中繼資料後匯出。', 'feature', 'image'],
  ['image-compressor', '圖片壓縮', '調整品質縮小檔案並預覽。', 'feature', 'image'],
  ['image-converter', '圖片格式轉換', 'JPG／PNG／WebP 互轉。', 'feature', 'image'],
  ['image-resizer', '圖片縮放', '依寬高或比例縮放圖片。', 'feature', 'image'],
  ['ai-background-remover', 'AI 去背（本機）', '以亮度／邊緣啟發式去除背景（本機 Canvas）。', 'feature', 'image'],
  ['social-cropper', '社群裁切', '依各平台比例一鍵裁切。', 'feature', 'image'],
  ['image-cropper', '圖片裁切', '自訂區域裁切圖片。', 'feature', 'image'],
  ['image-rotator', '圖片旋轉', '90°／任意角度旋轉。', 'feature', 'image'],
  ['image-flipper', '圖片翻轉', '水平或垂直翻轉。', 'feature', 'image'],
  ['image-rounded', '圖片圓角', '輸出圓角或圓形遮罩。', 'feature', 'image'],
  ['image-border', '圖片加邊框', '為圖片加上自訂邊框。', 'feature', 'image'],
  ['image-shadow', '圖片加陰影', '輸出帶陰影的透明 PNG。', 'feature', 'image'],
  ['image-blur', '圖片模糊', '高斯近似模糊。', 'feature', 'image'],
  ['image-sharpen', '圖片銳化', '簡易銳化濾鏡。', 'feature', 'image'],
  ['image-brightness', '圖片亮度調整', '調整亮度並匯出。', 'feature', 'image'],
  ['image-contrast', '圖片對比度調整', '調整對比並匯出。', 'feature', 'image'],
  ['image-saturation', '圖片飽和度調整', '調整飽和度並匯出。', 'feature', 'image'],
  ['image-grayscale', '黑白圖片', '轉為灰階。', 'feature', 'image'],
  ['image-invert', '負片效果', '反相色彩。', 'feature', 'image'],
  ['image-pixelate', '像素化', '像素化／馬賽克整圖。', 'feature', 'image'],
  ['image-collage', '圖片拼貼', '多圖拼貼成一張。', 'feature', 'image'],
  // PDF
  ['pdf-merge', 'PDF 合併', '合併多個 PDF（pdf-lib）。', 'feature', 'pdf'],
  ['pdf-split', 'PDF 分割', '依頁碼範圍分割 PDF。', 'feature', 'pdf'],
  ['pdf-organizer', 'PDF 頁面排序', '重新排列 PDF 頁序。', 'feature', 'pdf'],
  ['pdf-rotate', 'PDF 頁面旋轉', '旋轉指定頁面。', 'feature', 'pdf'],
  ['pdf-delete-pages', 'PDF 頁面刪除', '刪除選定頁面。', 'feature', 'pdf'],
  ['images-to-pdf', '圖片 → PDF', '多張圖片合成 PDF。', 'feature', 'pdf'],
  ['pdf-to-image', 'PDF → 圖片', '將 PDF 頁面渲成圖片。', 'feature', 'pdf'],
  ['pdf-compressor', 'PDF 壓縮', '重建頁面以縮小體積（示意）。', 'feature', 'pdf'],
  ['pdf-encrypt', 'PDF 加密', '為 PDF 設定開啟密碼。', 'feature', 'pdf'],
  ['pdf-page-number', 'PDF 頁碼', '為每頁加上頁碼。', 'feature', 'pdf'],
  ['pdf-header-footer', 'PDF Header / Footer', '加上頁首／頁尾文字。', 'feature', 'pdf'],
  ['pdf-sign', 'PDF 簽名', '貼上簽名圖片到 PDF。', 'feature', 'pdf'],
  ['pdf-form-filler', 'PDF 填寫', '填寫 AcroForm 欄位（若有）。', 'feature', 'pdf'],
  ['pdf-text-extractor', 'PDF 文字擷取', '擷取 PDF 文字（pdf.js）。', 'feature', 'pdf'],
  ['pdf-viewer', 'PDF 預覽器', '本機預覽 PDF 頁面。', 'feature', 'pdf'],
  ['markdown-to-pdf', 'Markdown → PDF', 'Markdown 轉簡易 PDF。', 'feature', 'pdf'],
  ['html-to-pdf', 'HTML → PDF', 'HTML 片段轉 PDF。', 'feature', 'pdf'],
  ['text-to-pdf', 'TXT → PDF', '純文字轉 PDF。', 'feature', 'pdf'],
  ['pdf-metadata', 'PDF Metadata Editor', '編輯 PDF 標題／作者等。', 'feature', 'pdf'],
  ['pdf-images', 'PDF 圖片擷取', '列出並匯出內嵌圖片資訊。', 'feature', 'pdf'],
  // File (skip json-to-csv — already exists)
  ['batch-rename', '批次重新命名', '依規則預覽並重新命名檔名清單。', 'feature', 'data'],
  ['filename-cleaner', '檔名清理器', '移除非法字元與空白。', 'feature', 'data'],
  ['file-size-analyzer', '檔案大小分析', '分析本機選取檔案大小。', 'feature', 'data'],
  ['mime-type', 'MIME Type Lookup', '依副檔名／檔案推斷 MIME。', 'feature', 'data'],
  ['zip-builder', 'ZIP 建立器', '將多檔打包成 ZIP。', 'feature', 'data'],
  ['zip-extractor', 'ZIP 解壓工具', '瀏覽器內解壓 ZIP。', 'feature', 'data'],
  ['csv-viewer', 'CSV Viewer', '預覽 CSV 表格。', 'feature', 'data'],
  ['csv-editor', 'CSV Editor', '編輯 CSV 並下載。', 'feature', 'data'],
  ['csv-cleaner', 'CSV 清理器', '去空白列、修剪欄位。', 'feature', 'data'],
  ['csv-to-json', 'CSV → JSON', 'CSV 轉 JSON 陣列。', 'feature', 'data'],
  ['csv-to-tsv', 'CSV → TSV', 'CSV 與 TSV 互轉。', 'feature', 'data'],
  ['json-to-yaml', 'JSON → YAML', 'JSON 轉 YAML。', 'feature', 'data'],
  ['yaml-to-json', 'YAML → JSON', 'YAML 轉 JSON。', 'feature', 'data'],
  ['excel-to-csv', 'Excel → CSV', 'xlsx 轉 CSV（SheetJS）。', 'feature', 'data'],
  // Dev
  ['jwt-decoder', 'JWT Decoder', '解碼 JWT Header／Payload。', 'quick', 'dev'],
  ['jwt-generator', 'JWT Generator', '組裝示範用 JWT（非安全簽章）。', 'quick', 'dev'],
  ['uuid-bulk', 'UUID Bulk Generator', '批次產生大量 UUID。', 'quick', 'dev'],
  ['nanoid-generator', 'Nano ID Generator', '產生 NanoID 風格字串。', 'quick', 'dev'],
  ['ulid-generator', 'ULID Generator', '產生 ULID。', 'quick', 'dev'],
  ['hash-generator', 'Hash Generator', 'MD5 示意／SHA 系列（Web Crypto）。', 'quick', 'dev'],
  ['sha256', 'SHA-256 Generator', '計算文字或檔案 SHA-256。', 'quick', 'dev'],
  ['html-formatter', 'HTML Formatter', '簡易 HTML 縮排。', 'quick', 'dev'],
  ['css-formatter', 'CSS Formatter', '簡易 CSS 縮排。', 'quick', 'dev'],
  ['javascript-formatter', 'JavaScript Formatter', '簡易 JS 縮排。', 'quick', 'dev'],
  ['sql-formatter', 'SQL Formatter', '簡易 SQL 關鍵字換行。', 'quick', 'dev'],
  ['xml-formatter', 'XML Formatter', '簡易 XML 縮排。', 'quick', 'dev'],
  ['yaml-formatter', 'YAML Formatter', 'YAML 解析後再序列化。', 'quick', 'dev'],
  ['graphql-formatter', 'GraphQL Formatter', '簡易 GraphQL 縮排。', 'quick', 'dev'],
  ['json-diff', 'JSON Diff', '比較兩段 JSON 差異。', 'quick', 'dev'],
  ['text-diff', 'Text Diff', '行級文字差異。', 'quick', 'dev'],
  ['image-to-base64', 'Image → Base64', '圖片轉 Data URL／Base64。', 'quick', 'dev'],
  ['base64-to-image', 'Base64 → Image', 'Base64 還原為圖片下載。', 'quick', 'dev'],
  ['data-uri', 'Data URI Generator', '文字／檔案產生 Data URI。', 'quick', 'dev'],
  ['svg-optimizer', 'SVG Optimizer', '移除註解與多餘空白。', 'quick', 'dev'],
  // Design
  ['og-preview', 'Open Graph Preview', '預覽 OG 卡片外觀。', 'quick', 'design'],
  ['meta-tags', 'Meta Tag Generator', '產生 SEO／OG meta 標籤。', 'quick', 'design'],
  ['favicon-generator', 'Favicon Generator', '從圖片產生 favicon PNG。', 'quick', 'design'],
  ['web-manifest', 'Web Manifest Generator', '產生 web app manifest。', 'quick', 'design'],
  ['robots-generator', 'Robots.txt Generator', '產生 robots.txt。', 'quick', 'design'],
  ['sitemap-generator', 'Sitemap Generator', '產生 sitemap.xml。', 'quick', 'design'],
  ['gradient-generator', 'CSS Gradient Generator', '視覺化產生 CSS 漸層。', 'quick', 'design'],
  ['shadow-generator', 'CSS Shadow Generator', '產生 box-shadow。', 'quick', 'design'],
  ['color-palette', 'Color Palette Generator', '從主色衍生色票。', 'quick', 'design'],
  ['svg-generator', 'SVG Generator', '產生簡易 SVG 圖形。', 'quick', 'design'],
  // Privacy
  ['password-strength', 'Password Strength Checker', '評估密碼強度。', 'feature', 'security'],
  ['secure-password', 'Secure Password Generator', '高強度密碼產生（Web Crypto）。', 'feature', 'security'],
  ['secret-generator', 'Secret Token Generator', '產生 API secret／token。', 'feature', 'security'],
  ['totp', 'TOTP Generator', '本機 TOTP 驗證碼。', 'feature', 'security'],
  ['totp-qr', 'TOTP QR Generator', '產生 otpauth QR。', 'feature', 'security'],
  ['csp-generator', 'CSP Generator', '組裝 Content-Security-Policy。', 'feature', 'security'],
  ['http-header-analyzer', 'HTTP Header Analyzer', '貼上回應標頭做解析。', 'feature', 'security'],
  ['tracking-url-cleaner', 'Tracking Parameter Remover', '移除追蹤查詢參數。', 'feature', 'security'],
  ['privacy-checker', 'Privacy Metadata Checker', '檢查圖片／檔名隱私風險。', 'feature', 'security'],
  ['file-hash-checker', 'File Hash Checker', '計算檔案雜湊以核對完整性。', 'feature', 'security'],
]

function shell(title, body) {
  return `import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
${body}

const meta = getProject('${title}')!

export default function Page() {
  return (
    <ProjectShell meta={meta}>
      ${'CONTENT'}
    </ProjectShell>
  )
}
`.replace("getProject('" + title + "')", `getProject('${title}')`)
}

// We'll use template kinds instead - write a large generator file
console.log('defs', defs.length)
fs.writeFileSync(path.join(__dirname, 'local-first-defs.json'), JSON.stringify(defs, null, 2))
console.log('wrote defs')
