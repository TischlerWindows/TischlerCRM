export const PROFILE_PICTURE_KEY = 'profilePicture'

const MAX_PROFILE_PICTURE_FILE_SIZE = 10 * 1024 * 1024
const PROFILE_PICTURE_MAX_DIMENSION = 384

export async function resizeProfilePicture(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.')
  }
  if (file.size > MAX_PROFILE_PICTURE_FILE_SIZE) {
    throw new Error('Image must be 10 MB or smaller.')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, PROFILE_PICTURE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not process the selected image.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('Could not encode the selected image.')),
        'image/webp',
        0.82,
      )
    })
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Could not read the processed image.'))
      reader.onerror = () => reject(new Error('Could not read the processed image.'))
      reader.readAsDataURL(blob)
    })
  } finally {
    bitmap.close()
  }
}