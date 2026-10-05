'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper, { type Area } from 'react-easy-crop'
import Image from 'next/image'
import { Camera, Check, Loader2, RotateCcw, X } from 'lucide-react'
import { createCroppedProfilePicture } from '@/lib/profile-picture'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export interface ProfilePicturePickerHandle {
  open: () => void
}

interface ProfilePicturePickerProps {
  picture: string | null
  initials: string
  buttonClassName: string
  onSave: (picture: string) => Promise<void>
  disabled?: boolean
}

const ProfilePicturePicker = forwardRef<ProfilePicturePickerHandle, ProfilePicturePickerProps>(function ProfilePicturePicker({
  picture,
  initials,
  buttonClassName,
  onSave,
  disabled = false,
}, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const imageSourceRef = useRef<string | null>(null)
  const [imageSource, setImageSource] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const open = () => {
    if (!disabled && !saving) inputRef.current?.click()
  }

  useImperativeHandle(ref, () => ({ open }))

  useEffect(() => () => {
    if (imageSourceRef.current) URL.revokeObjectURL(imageSourceRef.current)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) closeEditor()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, saving])

  const closeEditor = () => {
    if (imageSourceRef.current) URL.revokeObjectURL(imageSourceRef.current)
    imageSourceRef.current = null
    setImageSource(null)
    setIsOpen(false)
    setError(null)
    setCroppedArea(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageSource(null)
      setError('Choose a JPG, PNG, or WebP image.')
      setIsOpen(true)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setImageSource(null)
      setError('Image must be 10 MB or smaller.')
      setIsOpen(true)
      return
    }

    if (imageSourceRef.current) URL.revokeObjectURL(imageSourceRef.current)
    const source = URL.createObjectURL(file)
    imageSourceRef.current = source
    setImageSource(source)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    setError(null)
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (!imageSource || !croppedArea || saving) return
    setSaving(true)
    setError(null)
    try {
      const result = await createCroppedProfilePicture(imageSource, croppedArea)
      await onSave(result)
      closeEditor()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile picture.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={open}
        disabled={disabled || saving}
        aria-label="Change profile picture"
        title="Change profile picture"
        className={`group relative flex shrink-0 items-center justify-center overflow-hidden ${buttonClassName} disabled:opacity-60`}
      >
        {picture
          ? <Image src={picture} alt="" fill unoptimized sizes="48px" className="object-cover" />
          : initials}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={event => { if (event.target === event.currentTarget && !saving) closeEditor() }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-picture-crop-title"
            className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h2 id="profile-picture-crop-title" className="text-sm font-semibold text-gray-900">Crop profile picture</h2>
                <p className="mt-0.5 text-xs text-gray-500">Drag to reposition, then adjust zoom.</p>
              </div>
              <button type="button" onClick={closeEditor} disabled={saving} aria-label="Close crop editor" className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-4">
              {imageSource ? (
                <div className="relative h-72 w-full overflow-hidden rounded bg-gray-950">
                  <Cropper
                    image={imageSource}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_, pixels) => setCroppedArea(pixels)}
                  />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded bg-gray-50 text-sm text-gray-400">Choose another image to continue.</div>
              )}

              {imageSource && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs text-gray-500">Zoom</span>
                  <input
                    aria-label="Profile picture zoom"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={event => setZoom(Number(event.target.value))}
                    className="min-w-0 flex-1 accent-[#151f6d]"
                  />
                  <button type="button" onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }} className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
                    <RotateCcw className="h-3.5 w-3.5" /> Center
                  </button>
                </div>
              )}

              {error && <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            </div>

            <footer className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button type="button" onClick={closeEditor} disabled={saving} className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => { void handleSave(); }} disabled={!imageSource || !croppedArea || saving} className="inline-flex items-center gap-1.5 rounded bg-[#151f6d] px-3 py-2 text-xs font-medium text-white hover:bg-[#1c2b99] disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {saving ? 'Saving…' : 'Save picture'}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
})

export default ProfilePicturePicker