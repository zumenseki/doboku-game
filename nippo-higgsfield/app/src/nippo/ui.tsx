import * as React from 'react'
import { cn } from './utils'

type Variant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
type Size = 'default' | 'sm' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  default: 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  outline: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
}

const sizes: Record<Size, string> = {
  default: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
  lg: 'h-14 px-6 text-base',
  icon: 'h-11 w-11',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'NippoButton'

const inputBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-sky-600 focus:outline-2 focus:outline-offset-0 focus:outline-sky-600/30 disabled:bg-slate-100'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, 'h-11 text-base', className)} {...props} />
  ),
)
Input.displayName = 'NippoInput'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, 'min-h-24 py-2 text-base', className)} {...props} />
))
Textarea.displayName = 'NippoTextarea'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(inputBase, 'h-11 text-base', className)} {...props} />
))
Select.displayName = 'NippoSelect'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-slate-700', className)} {...props} />
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props} />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-slate-100 px-4 py-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold text-slate-900', className)} {...props} />
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4', className)} {...props} />
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-3 text-sm text-slate-700">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel,
  destructive,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message}
    </Modal>
  )
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{children}</div>
}

export function SuccessBox({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
      {children}
    </div>
  )
}
