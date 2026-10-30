"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { ApiError } from "@/lib/api/core"
import { FinancialDomainError } from "@/lib/domain/financial/errors"
import { getLocalDateKey } from "@/lib/date-filters"
import { preparePendingTransaction, savePendingTransaction } from "@/lib/privacy/encrypted-authority/pending-transaction-operations"
import type { EncryptedFinancialAuthority, PreparedSourceBatch } from "@/lib/privacy/encrypted-authority/authority"
import { message } from "./review-ui"

async function submit(authority: EncryptedFinancialAuthority, batch: PreparedSourceBatch) {
  try { await authority.submitPreparedSourceDiff(batch) } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error
    if (error instanceof Error && /409|CONFLICT|VALIDATION|DISABLED|LOCKED/.test(error.message)) throw error
    await authority.submitPreparedSourceDiff(batch)
  }
}

type Options = { authority: EncryptedFinancialAuthority | null; busy: boolean; setBusy: (value: boolean) => void; onError: (value: string) => void; onNotice: (value: string) => void }

export function useQuickCapture({ authority, busy, setBusy, onError, onNotice }: Options) {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(getLocalDateKey)
  const [captureBatch, setCaptureBatch] = useState<PreparedSourceBatch | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setCaptureBatch(null); setAmount(""); setDescription(""); setDate(getLocalDateKey()) }, [authority])
  async function capture(event: FormEvent) {
    event.preventDefault(); if (!authority || busy) return
    setBusy(true); onError("")
    try {
      const deps = { authority, isAuthenticated: true }
      const batch = captureBatch ?? await savePendingTransaction(deps, preparePendingTransaction(deps, { amount, description, date }))
      setCaptureBatch(batch); await submit(authority, batch)
      setCaptureBatch(null); setAmount(""); setDescription(""); setDate(getLocalDateKey()); onNotice("Saved to Review.")
      if (document.activeElement === amountRef.current) amountRef.current?.focus()
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) setCaptureBatch(null)
      onError(err instanceof FinancialDomainError ? "Enter a positive amount, a description, or both, and use a valid date." : message(err))
    } finally { setBusy(false) }
  }
  return { amount, setAmount, description, setDescription, date, setDate, captureBatch, amountRef, capture }
}
