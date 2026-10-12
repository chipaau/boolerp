// Reads a transfer receipt (a photo or a PDF) into a compact data URL. Photos are scaled to 1000px
// and re-encoded as JPEG so they fit in browser storage; PDFs are kept as they are, up to 1.5 MB.
import type { Receipt } from '@/lib/data'

const MAX_PDF_BYTES = 1.5e6

export function readReceipt(file: File): Promise<Receipt> {
  return new Promise((resolve, reject) => {
    const isImg = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImg && !isPdf) return reject(new Error('Please upload a photo or a PDF.'))
    if (isPdf && file.size > MAX_PDF_BYTES) return reject(new Error('That PDF is over 1.5 MB. Try a photo of the receipt instead.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const data = String(reader.result)
      if (isPdf) return resolve({ name: file.name, data, isImg: false, at: Date.now() })
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.onload = () => {
        const k = Math.min(1, 1000 / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * k)
        canvas.height = Math.round(img.height * k)
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ name: file.name, data: canvas.toDataURL('image/jpeg', 0.72), isImg: true, at: Date.now() })
      }
      img.src = data
    }
    reader.readAsDataURL(file)
  })
}
