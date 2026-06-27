"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { TRANSACTION_NOTES_COUNTER_THRESHOLD, TRANSACTION_NOTES_MAX_LENGTH } from "@/lib/transaction-notes"

interface TransactionNotesFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string | null
}

export function TransactionNotesField({
  value,
  onChange,
  error = null,
}: TransactionNotesFieldProps) {
  const shouldShowCounter = value.length >= TRANSACTION_NOTES_COUNTER_THRESHOLD

  return (
    <div className="space-y-2">
      <Label htmlFor="transaction-notes" className="text-sm font-medium">
        Note
      </Label>

      <Textarea
        id="transaction-notes"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add a short note..."
        rows={3}
        maxLength={TRANSACTION_NOTES_MAX_LENGTH}
        aria-invalid={error ? "true" : "false"}
        className={cn(
          "min-h-[4.75rem] rounded-xl border-border/60 bg-background/60 align-top shadow-none focus-visible:ring-2 focus-visible:ring-ring/25",
          error && "border-destructive focus-visible:ring-destructive/20"
        )}
      />

      <div className="flex min-h-5 items-center justify-between gap-2">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <span />
        )}
        {shouldShowCounter ? (
          <p className="text-xs text-muted-foreground">
            {value.length} / {TRANSACTION_NOTES_MAX_LENGTH}
          </p>
        ) : null}
      </div>
    </div>
  )
}
