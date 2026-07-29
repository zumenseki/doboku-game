'use client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'

export function DateJump({ date }: { date: string }) {
  const router = useRouter()
  return (
    <Input
      type="date"
      defaultValue={date}
      className="h-9 w-44"
      aria-label="表示する日付"
      onChange={(e) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
          router.push(`/admin?date=${e.target.value}`)
        }
      }}
    />
  )
}
