"use client"

import { useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatCategory, getCategoryColorClass } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import type { Transaction } from "@/lib/api/types"
import { CalendarDays, Tag as TagGlyph, CreditCard, Folder, Users, Pencil, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import { mobileDrawerHandleClassName } from "@/lib/mobile-drawer"

interface TransactionDetailSheetProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (transaction: Transaction) => void
  onDelete: (transactionId: string) => void
  isDeleting?: boolean
}

function formatDate(dateStr: string): string {
  const isoDateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = isoDateMatch
    ? new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    : new Date(dateStr)

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function TransactionDetailSheet({
  transaction,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  isDeleting = false,
}: TransactionDetailSheetProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const swipeDismiss = useSwipeDismiss({
    open,
    onDismiss: () => onOpenChange(false),
    scrollRef: scrollContainerRef,
  })

  if (!transaction) return null
  const TagIcon = getTagIcon(transaction.tag.name, transaction.tag.icon_key)

  const handleDelete = () => {
    onDelete(transaction.id)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...swipeDismiss}
        ref={scrollContainerRef}
        side="bottom"
        className="h-auto max-h-[90vh] overflow-y-auto rounded-t-3xl px-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div data-swipe-handle="true" className={`${mobileDrawerHandleClassName} mt-1 sm:hidden`} aria-hidden="true" />
        <SheetHeader className="pb-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${getCategoryColorClass(transaction.category)} flex items-center justify-center`}>
              <TagIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-xl text-left">{transaction.expense}</SheetTitle>
              <p className="text-3xl font-bold mt-1">
                -{formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>
        </SheetHeader>
        
        <div className="space-y-4 pb-6">
          {/* Details Grid */}
          <div className="bg-secondary/50 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(transaction.date)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center">
                <Folder className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium">{formatCategory(transaction.category)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center">
                <TagGlyph className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tag</p>
                <p className="font-medium">{transaction.tag.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Split</p>
                <p className="font-medium">{transaction.is_split ? "Yes" : "No"}</p>
              </div>
            </div>
            
            {transaction.card && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Card</p>
                  <p className="font-medium">{transaction.card.name}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Button
              variant="outline"
              className="h-12 rounded-xl w-full"
              onClick={() => onEdit?.(transaction)}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl w-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this transaction. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
