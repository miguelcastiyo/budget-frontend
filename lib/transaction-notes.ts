"use client"

export const TRANSACTION_NOTES_MAX_LENGTH = 255
export const TRANSACTION_NOTES_COUNTER_THRESHOLD = 200

export function normalizeTransactionNotesForSubmit(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function validateTransactionNotes(value: string): string | null {
  if (value.length > TRANSACTION_NOTES_MAX_LENGTH) {
    return "Note must be 255 characters or fewer."
  }

  return null
}

export function buildTransactionMoreDetailsSummary(input: {
  cardName?: string | null
  contextName?: string | null
  isSplit?: boolean
  hasRecurring?: boolean
  hasNotes?: boolean
}): string {
  const active: string[] = []

  if (input.cardName) active.push(input.cardName)
  if (input.contextName) active.push(input.contextName)
  if (input.isSplit) active.push("Split")
  if (input.hasRecurring) active.push("Recurring")
  if (input.hasNotes) active.push("Note added")

  if (active.length > 0) {
    return active.join(" · ")
  }

  return "Card, split, recurring, and notes"
}
