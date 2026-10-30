"use client"

import Link from "next/link"
import type { EncryptedFinancialAuthority } from "@/lib/privacy/encrypted-authority/authority"
import { button, field } from "./review-ui"
import { useQuickCapture } from "./use-quick-capture"

type Props = { authority: EncryptedFinancialAuthority | null; busy: boolean; setBusy: (value: boolean) => void; onError: (value: string) => void; onNotice: (value: string) => void }
export function QuickCapture({ authority, busy, setBusy, onError, onNotice }: Props) {
  const { amount, setAmount, description, setDescription, date, setDate, captureBatch, amountRef, capture } = useQuickCapture({ authority, busy, setBusy, onError, onNotice })
  return <form onSubmit={capture} className="space-y-3" aria-label="Quick Capture">
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Amount<input ref={amountRef} className={field} inputMode="decimal" value={amount} disabled={Boolean(captureBatch)} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label><label className="text-sm font-medium">Date<input className={field} type="date" value={date} disabled={Boolean(captureBatch)} onChange={(e) => setDate(e.target.value)} /></label></div>
    <label className="block text-sm font-medium">Description<input className={field} value={description} disabled={Boolean(captureBatch)} onChange={(e) => setDescription(e.target.value)} placeholder="What was it?" /></label>
    <p className="text-xs text-muted-foreground">{captureBatch ? "The save outcome is uncertain. Retry to confirm it." : "Enter an amount, a description, or both."}</p><button className={button} disabled={busy || !authority}>Save expense</button>
    <Link href="/transactions?add=1" className="ml-4 inline-block py-3 text-sm underline">Full transaction entry</Link>
  </form>
}
