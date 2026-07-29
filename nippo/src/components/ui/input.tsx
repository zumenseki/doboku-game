import * as React from 'react'
import { cn } from '@/lib/utils'

const base =
  'w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-sky-600 focus:outline-2 focus:outline-offset-0 focus:outline-sky-600/30 disabled:bg-slate-100'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, 'h-11 text-base', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-24 py-2 text-base', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(base, 'h-11 text-base', className)} {...props} />
))
Select.displayName = 'Select'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-slate-700', className)} {...props} />
}
