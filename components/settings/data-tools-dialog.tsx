"use client"

import { useRef } from "react"
import { Download, Upload, X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import { cn } from "@/lib/utils"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"

interface DataToolsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: () => void
  onExport: () => void
}

export function DataToolsDialog({ open, onOpenChange, onImport, onExport }: DataToolsDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const swipeDismiss = useSwipeDismiss({
    open,
    onDismiss: () => onOpenChange(false),
    scrollRef: contentRef,
  })

  const chooseAction = (action: () => void) => {
    onOpenChange(false)
    window.setTimeout(action, 140)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        {...swipeDismiss}
        className={cn(
          "gap-0 overflow-hidden border-border/70 p-0 shadow-2xl sm:max-w-md",
          mobileDrawerDialogClassName
        )}
      >
        <div data-swipe-handle="true" className="flex justify-center pt-3 sm:hidden">
          <div className={cn(mobileDrawerHandleClassName, "sm:hidden")} />
        </div>
        <div ref={contentRef} className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 sm:p-6">
          <DialogHeader className="gap-2 pr-10 text-left">
            <DialogTitle>Data Import / Export</DialogTitle>
            <DialogDescription>
              Import a transaction CSV or export transactions by date range.
            </DialogDescription>
          </DialogHeader>

          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Close data tools"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>

          <div className="mt-5 grid gap-3">
            <Button
              type="button"
              className="h-14 justify-start rounded-2xl px-4 text-base"
              onClick={() => chooseAction(onImport)}
            >
              <Upload className="h-5 w-5" />
              Import CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-14 justify-start rounded-2xl px-4 text-base"
              onClick={() => chooseAction(onExport)}
            >
              <Download className="h-5 w-5" />
              Export CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
