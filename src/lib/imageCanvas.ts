/** Shared Canvas image helpers for local-first tools. */

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('無法讀取圖片'))
    }
    img.src = url
  })
}

export function canvasFromImage(img: HTMLImageElement, w?: number, h?: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w ?? img.naturalWidth))
  canvas.height = Math.max(1, Math.round(h ?? img.naturalHeight))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { canvas, ctx }
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string, type = 'image/png', quality = 0.92) {
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    },
    type,
    quality,
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function fileToDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('讀取失敗'))
    r.readAsDataURL(file)
  })
}

export async function fileToArrayBuffer(file: File) {
  return file.arrayBuffer()
}

export function getImageData(canvas: HTMLCanvasElement) {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
}

export function putImageData(canvas: HTMLCanvasElement, data: ImageData) {
  canvas.getContext('2d')!.putImageData(data, 0, 0)
}

/** Apply per-pixel RGB transform. */
export function mapPixels(
  canvas: HTMLCanvasElement,
  fn: (r: number, g: number, b: number, a: number, i: number) => [number, number, number, number],
) {
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = fn(d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!, i)
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
    d[i + 3] = a
  }
  ctx.putImageData(img, 0, 0)
}

export function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export const IMAGE_ACCEPT = 'image/*,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'
export const IMAGE_MAX_BYTES = 12 * 1024 * 1024
