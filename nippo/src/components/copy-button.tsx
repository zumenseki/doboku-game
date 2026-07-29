'use client'
import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'

export function CopyButton({ text, children = 'コピー', ...props }: ButtonProps & { text: string }) {
  const [copied, setCopied] = React.useState(false)

  return (
    <Button
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('コピーしてください', text)
        }
      }}
    >
      {copied ? 'コピーしました' : children}
    </Button>
  )
}
