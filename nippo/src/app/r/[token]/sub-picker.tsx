'use client'
import * as React from 'react'
import { Modal } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type SubOption = { id: string; name: string }

/** 検索付きセレクト（スマホ片手操作前提のボトムシート） */
export function SubPicker({
  subs,
  value,
  onChange,
}: {
  subs: SubOption[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const selected = subs.find((s) => s.id === value)
  const filtered = query.trim()
    ? subs.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : subs

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery('')
          setOpen(true)
        }}
        className={cn(
          'flex h-12 w-full items-center justify-between rounded-lg border px-3 text-left text-base',
          selected ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-300 bg-white text-slate-400',
        )}
      >
        <span className="truncate">{selected ? selected.name : '業者を選択'}</span>
        <span className="ml-2 shrink-0 text-slate-400">▼</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="業者を選択">
        <Input
          autoFocus
          placeholder="業者名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-3"
        />
        <ul className="max-h-[50dvh] overflow-y-auto rounded-lg border border-slate-200">
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">該当する業者がありません</li>
          )}
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(s.id)
                  setOpen(false)
                }}
                className={cn(
                  'w-full border-b border-slate-100 px-3 py-3 text-left text-base last:border-b-0',
                  s.id === value ? 'bg-sky-50 font-semibold text-sky-800' : 'hover:bg-slate-50',
                )}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  )
}
