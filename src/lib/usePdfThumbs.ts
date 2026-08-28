import { useEffect, useRef, useState } from 'react'
import {
  type PdfThumbMap,
  renderPdfPageThumbs,
  revokePdfThumbs,
  PDF_MAX_PAGES,
} from './pdf'

/** Load & revoke page thumbnails when `file` / `pageCount` change. */
export function usePdfThumbs(file: File | null, pageCount: number) {
  const [thumbs, setThumbs] = useState<PdfThumbMap>({})
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const runId = useRef(0)
  const thumbsRef = useRef<PdfThumbMap>({})

  useEffect(() => {
    thumbsRef.current = thumbs
  }, [thumbs])

  useEffect(() => {
    return () => {
      runId.current += 1
      revokePdfThumbs(thumbsRef.current)
    }
  }, [])

  useEffect(() => {
    if (!file || pageCount < 1) {
      revokePdfThumbs(thumbsRef.current)
      setThumbs({})
      setLoading(false)
      setProgress('')
      return
    }
    const id = ++runId.current
    let cancelled = false
    setLoading(true)
    setProgress('')
    ;(async () => {
      try {
        const data = new Uint8Array(await file.arrayBuffer())
        if (cancelled || id !== runId.current) return
        const next = await renderPdfPageThumbs(data, {
          pageCount: Math.min(pageCount, PDF_MAX_PAGES),
          isCancelled: () => cancelled || id !== runId.current,
          onProgress: (p, n) => {
            if (id === runId.current) setProgress(`載入縮圖 ${p}/${n}`)
          },
        })
        if (cancelled || id !== runId.current) {
          revokePdfThumbs(next)
          return
        }
        revokePdfThumbs(thumbsRef.current)
        setThumbs(next)
      } catch {
        if (id === runId.current) {
          revokePdfThumbs(thumbsRef.current)
          setThumbs({})
        }
      } finally {
        if (id === runId.current) {
          setLoading(false)
          setProgress('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file, pageCount])

  return { thumbs, loading, progress }
}
