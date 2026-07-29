'use client'
import * as React from 'react'
import imageCompression from 'browser-image-compression'
import { MAX_PHOTOS_PER_REPORT, MAX_PHOTO_BYTES } from '@/lib/validation'

export type PhotoItem = {
  id: string
  previewUrl: string
  file: File | null
  bytes: number
  status: 'compressing' | 'ready' | 'uploading' | 'uploaded' | 'error'
  objectKey?: string
  error?: string
}

/** 長辺1600px / WebP / quality 0.75（§4） */
export async function compressPhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: 1600,
    fileType: 'image/webp',
    initialQuality: 0.75,
    maxSizeMB: MAX_PHOTO_BYTES / (1024 * 1024),
    useWebWorker: true,
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function PhotoInput({
  photos,
  onAdd,
  onRemove,
  disabled,
}: {
  photos: PhotoItem[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const remaining = MAX_PHOTOS_PER_REPORT - photos.length

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
              {p.status === 'compressing' && '圧縮中…'}
              {p.status === 'ready' && formatBytes(p.bytes)}
              {p.status === 'uploading' && '送信中…'}
              {p.status === 'uploaded' && '✓ 送信済'}
              {p.status === 'error' && '失敗'}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                aria-label="写真を削除"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {remaining > 0 && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-white text-slate-500"
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs">写真を追加</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, remaining)
          if (files.length > 0) onAdd(files)
          e.target.value = ''
        }}
      />
      <p className="mt-2 text-xs text-slate-500">
        最大{MAX_PHOTOS_PER_REPORT}枚。自動で縮小してから送信します。
      </p>
    </div>
  )
}
