import { useRef, useState } from 'react'
import { formatBytes } from './utils'
import { canvasFromImage, loadImageFromFile, IMAGE_MAX_BYTES } from './imageCanvas'

export type ImageMeta = {
  fileName: string
  fileSize: number
  width: number
  height: number
}

const emptyMeta: ImageMeta = { fileName: '', fileSize: 0, width: 0, height: 0 }

/** Load an image file into an HTMLImageElement for tools that draw from the original. */
export function useImageFile() {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [meta, setMeta] = useState<ImageMeta>(emptyMeta)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)

  async function onFile(file: File | null) {
    if (!file) return false
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return false
    }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      imgRef.current = img
      setMeta({
        fileName: file.name,
        fileSize: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
      setHasImage(true)
      return true
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
      return false
    }
  }

  return {
    imgRef,
    ...meta,
    error,
    setError,
    hasImage,
    onFile,
  }
}

/** Load an image file into an offscreen canvas for pixel / filter tools. */
export function useImageCanvasSource() {
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [meta, setMeta] = useState<ImageMeta>(emptyMeta)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)

  async function onFile(file: File | null) {
    if (!file) return false
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return false
    }
    try {
      setError('')
      const canvas = canvasFromImage(await loadImageFromFile(file)).canvas
      srcRef.current = canvas
      setMeta({
        fileName: file.name,
        fileSize: file.size,
        width: canvas.width,
        height: canvas.height,
      })
      setHasImage(true)
      return true
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
      return false
    }
  }

  return {
    srcRef,
    ...meta,
    error,
    setError,
    hasImage,
    onFile,
  }
}
