import { Link } from 'react-router-dom'

/** 非 FeatureLayout 頁面（實用小工具等）底部簡短信任說明 */
export function LabTrustNotice() {
  return (
    <aside className="lab-trust panel" aria-label="保存與安全說明">
      <h3 className="pw-panel-title">保存與安全</h3>
      <ul className="pw-info-list">
        <li>
          <span className="muted">保存多久</span>
          <strong>寫在本機瀏覽器，直到你清除資料或換裝置</strong>
        </li>
        <li>
          <span className="muted">惡意利用</span>
          <strong>前端示範，無托管後端，不適合正式上線</strong>
        </li>
      </ul>
      <p className="muted lab-trust-hint">
        日常應用各頁底部有更完整 FAQ。全站說明見{' '}
        <Link to="/#lab-trust">主頁「保存與安全」</Link>。
      </p>
    </aside>
  )
}
