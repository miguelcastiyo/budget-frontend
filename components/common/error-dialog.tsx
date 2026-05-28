"use client"

import { useState } from "react"
import { AlertTriangle, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ErrorDialogState {
  title: string
  message: string
  requestId?: string
  status?: number
  code?: string
}

interface ErrorDialogProps {
  error: ErrorDialogState | null
  onOpenChange: (open: boolean) => void
  onRetry?: () => void
}

export function ErrorDialog({ error, onOpenChange, onRetry }: ErrorDialogProps) {
  const [copied, setCopied] = useState(false)

  const copyRequestId = async () => {
    if (!error?.requestId || typeof navigator === "undefined" || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(error.requestId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={!!error} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader className="gap-3">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-2">
            <DialogTitle>{error?.title ?? "Something went wrong"}</DialogTitle>
            <DialogDescription>{error?.message}</DialogDescription>
          </div>
        </DialogHeader>

        {(error?.requestId || error?.status || error?.code) && (
          <div className="rounded-xl border border-border/70 bg-muted/45 p-3 text-sm">
            {error.requestId && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Request ID</p>
                  <p className="truncate font-mono text-xs text-foreground">{error.requestId}</p>
                </div>
                <Button type="button" variant="outline" size="icon-sm" onClick={() => void copyRequestId()}>
                  <Copy className="size-3.5" />
                  <span className="sr-only">Copy request ID</span>
                </Button>
              </div>
            )}

            {(error.status || error.code) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {[error.status ? `HTTP ${error.status}` : null, error.code].filter(Boolean).join(" · ")}
              </p>
            )}

            {copied && <p className="mt-2 text-xs text-foreground">Copied</p>}
          </div>
        )}

        <DialogFooter>
          {onRetry && (
            <Button type="button" onClick={onRetry}>
              Retry
            </Button>
          )}
          <Button type="button" variant={onRetry ? "outline" : "default"} onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
