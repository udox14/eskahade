export async function compressImageFile(
  file: File,
  options?: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    mimeType?: 'image/jpeg' | 'image/webp'
  }
) {
  const maxWidth = options?.maxWidth ?? 1400
  const maxHeight = options?.maxHeight ?? 1400
  const quality = options?.quality ?? 0.72
  const mimeType = options?.mimeType ?? 'image/jpeg'

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = event => {
      const image = new window.Image()
      image.onerror = () => reject(new Error('Gagal memproses gambar'))
      image.onload = () => {
        const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * ratio))
        canvas.height = Math.max(1, Math.round(image.height * ratio))
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Canvas tidak tersedia'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL(mimeType, quality))
      }
      image.src = String(event.target?.result || '')
    }
    reader.readAsDataURL(file)
  })
}
