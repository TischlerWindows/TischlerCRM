export const PROFILE_PICTURE_KEY = 'profilePicture'

export interface ProfilePictureCrop {
  x: number
  y: number
  width: number
  height: number
}

const OUTPUT_SIZE = 384

export async function createCroppedProfilePicture(imageSource: string, crop: ProfilePictureCrop): Promise<string> {
  const image = new window.Image()
  image.src = imageSource
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Could not load the selected image.'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not process the selected image.')
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('Could not encode the cropped image.')),
      'image/webp',
      0.84,
    )
  })
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read the cropped image.'))
    reader.onerror = () => reject(new Error('Could not read the cropped image.'))
    reader.readAsDataURL(blob)
  })
}