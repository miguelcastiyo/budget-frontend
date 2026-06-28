"use client"

import { CreditCard, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransactionPresenceIndicatorsProps {
  hasCard?: boolean
  hasNotes?: boolean
  className?: string
  iconClassName?: string
}

export function TransactionPresenceIndicators({
  hasCard = false,
  hasNotes = false,
  className,
  iconClassName,
}: TransactionPresenceIndicatorsProps) {
  if (!hasCard && !hasNotes) {
    return null
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
      {hasCard && (
        <span className="inline-flex items-center" title="Has card" aria-label="Has card">
          <CreditCard className={cn("h-3.5 w-3.5", iconClassName)} />
        </span>
      )}
      {hasNotes && (
        <span className="inline-flex items-center" title="Has note" aria-label="Has note">
          <FileText className={cn("h-3.5 w-3.5", iconClassName)} />
        </span>
      )}
    </span>
  )
}
