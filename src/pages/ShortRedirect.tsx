import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadJSON, saveJSON } from '../lib/storage'

type LinkItem = {
  id: string
  code: string
  url: string
  createdAt: number
  clicks: number
  note?: string
}

export function ShortRedirect() {
  const { code = '' } = useParams()
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const key = 'lab:url-shortener'
    const links = loadJSON<LinkItem[]>(key, [])
    const hit = links.find((l) => l.code === code)
    if (!hit || !hit.url) {
      setMissing(true)
      return
    }
    const next = links.map((l) => (l.id === hit.id ? { ...l, clicks: l.clicks + 1 } : l))
    saveJSON(key, next)
    window.location.replace(hit.url)
  }, [code])

  if (!missing) {
    return (
      <div className="panel stack">
        <p className="muted">正在轉址…</p>
      </div>
    )
  }

  return (
    <div className="panel stack">
      <h2>找不到短碼</h2>
      <p className="muted">
        短碼「{code}」不存在，或尚未在本瀏覽器建立。
      </p>
      <Link className="btn accent sm" to="/p/url-shortener">
        前往短網址工具
      </Link>
      <Link className="btn ghost sm" to="/">
        回主頁
      </Link>
    </div>
  )
}
