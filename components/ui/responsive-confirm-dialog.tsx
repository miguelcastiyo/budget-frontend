"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
import { cn } from "@/lib/utils"

interface ResponsiveConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  cancelLabel?: string
  confirmVariant?: "default" | "destructive"
  confirmDisabled?: boolean
  closeDisabled?: boolean
  desktopClassName?: string
  contentClassName?: string
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
}

export function ResponsiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmVariant = "default",
  confirmDisabled = false,
  closeDisabled = false,
  desktopClassName = "sm:w-[min(calc(100dvw-2rem),32rem)] sm:max-w-[32rem]",
  contentClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
}: ResponsiveConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex h-auto max-h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),30rem)] w-full grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:bottom-auto sm:max-h-[min(90dvh,30rem)] sm:rounded-2xl sm:border",
          desktopClassName,
          mobileDrawerDialogClassName,
          contentClassName
        )}
      >
        <DialogHeader
          className={cn(
            "shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 sm:py-4",
            headerClassName
          )}
        >
          <div className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold sm:text-xl">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </DialogDescription>
              )}
            </div>
            <DialogClose
              disabled={closeDisabled}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>

        {children && (
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5", bodyClassName)}>
            {children}
          </div>
        )}

        <div
          className={cn(
            "shrink-0 border-t border-border/50 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-6 sm:pt-4",
            footerClassName
          )}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-xl px-4"
              onClick={() => onOpenChange(false)}
              disabled={closeDisabled}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmVariant === "destructive" ? "destructive" : "default"}
              className="h-12 rounded-xl"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
