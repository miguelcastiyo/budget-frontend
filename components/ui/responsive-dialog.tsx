"use client"

import { useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
import { cn } from "@/lib/utils"

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  headerAccessory?: ReactNode
  showCloseButton?: boolean
  closeDisabled?: boolean
  contentClassName?: string
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
  desktopClassName?: string
  bodyMaxWidthClassName?: string
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  headerAccessory,
  showCloseButton = true,
  closeDisabled = false,
  contentClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
  desktopClassName = "sm:w-[min(calc(100dvw-2rem),38rem)] sm:max-w-[38rem]",
  bodyMaxWidthClassName,
}: ResponsiveDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const swipeDismiss = useSwipeDismiss({
    open,
    onDismiss: () => onOpenChange(false),
    scrollRef,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...swipeDismiss}
        showCloseButton={false}
        className={cn(
          "flex h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),46rem)] w-full grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,46rem)] sm:rounded-2xl sm:border",
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
          <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
          <div className={cn("grid gap-3", headerAccessory && "md:grid-cols-[minmax(0,1fr)_auto] md:items-center")}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg font-semibold sm:text-xl">{title}</DialogTitle>
                {description && (
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    {description}
                  </DialogDescription>
                )}
              </div>
              {showCloseButton && (
                <DialogClose
                  disabled={closeDisabled}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              )}
            </div>
            {headerAccessory}
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5", bodyClassName)}
        >
          <div className={cn(bodyMaxWidthClassName)}>{children}</div>
        </div>

        {footer && (
          <div
            className={cn(
              "shrink-0 border-t border-border/50 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-6 sm:pt-4",
              footerClassName
            )}
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
