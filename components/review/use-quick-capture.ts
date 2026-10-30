"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { ApiError } from "@/lib/api/core"
import { FinancialDomainError } from "@/lib/domain/financial/errors"
import { getLocalDateKey } from "@/lib/date-filters"
import { preparePendingTransaction, savePendingTransaction } from "@/lib/privacy/encrypted-authority/pending-transaction-operations"
import type { EncryptedFinancialAuthority, PreparedSourceBatch } from "@/lib/privacy/encrypted-authority/authority"
import { message } from "./review-ui"
import { rememberCapture, clearRememberedCapture, getRememberedCapture } from "./capture-recovery"

async function submit(authority: EncryptedFinancialAuthority, batch: PreparedSourceBatch, onUncertain: () => void) {
  try { await authority.submitPreparedSourceDiff(batch) } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error
    if (error instanceof Error && /409|CONFLICT|VALIDATION|DISABLED|LOCKED/.test(error.message)) throw error
    onUncertain()
    await authority.submitPreparedSourceDiff(batch)
  }
}

type Draft = { amount: string; setAmount: (value: string) => void; description: string; setDescription: (value: string) => void; date: string; setDate: (value: string) => void }
type Options = { authority: EncryptedFinancialAuthority | null; busy: boolean; setBusy: (value: boolean) => void; onError: (value: string) => void; onNotice: (value: string) => void; draft?: Draft; onSaved?: () => void; accountId?: string }

export function useQuickCapture({ authority, busy, setBusy, onError, onNotice, draft, onSaved, accountId }: Options) {
  const [internalAmount, setInternalAmount] = useState("")
  const [internalDescription, setInternalDescription] = useState("")
  const [internalDate, setInternalDate] = useState(getLocalDateKey)
  const { amount, setAmount, description, setDescription, date, setDate } = draft ?? { amount: internalAmount, setAmount: setInternalAmount, description: internalDescription, setDescription: setInternalDescription, date: internalDate, setDate: setInternalDate }
  const [captureBatch, setCaptureBatch] = useState<PreparedSourceBatch | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const batchAuthority = useRef<EncryptedFinancialAuthority | null>(null)
  const outcomeUncertain = useRef(false)
  const inFlight = useRef(false)
  useEffect(() => { if (!draft) { setCaptureBatch(null); setInternalAmount(""); setInternalDescription(""); setInternalDate(getLocalDateKey()) } }, [authority])
  async function capture(event: FormEvent) {
    event.preventDefault(); if (!authority || busy || inFlight.current) return
    if (captureBatch && batchAuthority.current !== authority) { onError("The save outcome is uncertain. Sync Review to check it before continuing."); return }
    inFlight.current = true; setBusy(true); onError("")
    try {
      const deps = { authority, isAuthenticated: true }
      let batch = captureBatch
      if (!batch) {
        const pending = preparePendingTransaction(deps, { amount, description, date })
        batch = await savePendingTransaction(deps, pending)
        if (draft && accountId) rememberCapture(accountId, pending.id)
        batchAuthority.current = authority
      }
      setCaptureBatch(batch); await submit(authority, batch, () => { outcomeUncertain.current = true })
      if (accountId) { const id = getRememberedCapture(accountId); if (id) clearRememberedCapture(accountId, id) }
      outcomeUncertain.current = false; setCaptureBatch(null); setAmount(""); setDescription(""); setDate(getLocalDateKey()); onNotice("Saved to Review."); onSaved?.()
      if (document.activeElement === amountRef.current) amountRef.current?.focus()
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && !outcomeUncertain.current) { setCaptureBatch(null); if (accountId) { const id = getRememberedCapture(accountId); if (id) clearRememberedCapture(accountId, id) } }
      onError(err instanceof FinancialDomainError ? "Enter a positive amount, a description, or both, and use a valid date." : message(err))
    } finally { inFlight.current = false; setBusy(false) }
  }
  const resolveConfirmed = () => { outcomeUncertain.current = false; setCaptureBatch(null); batchAuthority.current = null }
  return { amount, setAmount, description, setDescription, date, setDate, captureBatch, amountRef, capture, resolveConfirmed }
}
