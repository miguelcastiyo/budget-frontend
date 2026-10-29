"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ApiError } from "@/lib/api/core"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { PendingReviewSession } from "@/lib/privacy/encrypted-authority/pending-lifecycle"
import type { Card, Context, Tag } from "@/lib/api/types"
import { ReviewItem } from "@/components/review/review-item"
import { message } from "@/components/review/review-ui"
import { QuickCapture } from "@/components/review/quick-capture"
import type { PreparedSourceBatch } from "@/lib/privacy/encrypted-authority/authority"

export default function ReviewPage() {
  const api = useFinancialAuthority()
  const [finalizedCount, setFinalizedCount] = useState(0)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [undoBatch, setUndoBatch] = useState<PreparedSourceBatch | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [references, setReferences] = useState<{ tags: Tag[]; cards: Card[]; contexts: Context[] }>({ tags: [], cards: [], contexts: [] })
  const authority = api.authority
  const authorityVersion = authority?.getVersion()
  const enabled = api.pendingCaptureEnabled || api.pendingGlobalCount > 0 || canUndo
  const session = useMemo(() => authority ? new PendingReviewSession({ authority, isAuthenticated: true }) : null, [authority])
  useEffect(() => { setSkipped(new Set()); setFinalizedCount(0); setCanUndo(false); setUndoBatch(null) }, [authority])
  useEffect(() => {
    if (!authority || !enabled) return
    let active = true
    void api.getTransactionReferences().then((refs) => { if (active) setReferences(refs) }).catch(() => { if (active) setError("Could not load tags and account details.") })
    return () => { active = false }
  }, [authority, authorityVersion, enabled, api.getTransactionReferences])
  const queue = authority ? [...authority.getState().pendingTransactions].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id)) : []
  const current = queue.find((item) => !skipped.has(item.id))
  const deps = authority ? { authority, isAuthenticated: true } : null
  async function undo() {
    if (!session || busy) return
    setBusy(true); setError("")
    try { const batch = undoBatch ?? await session.prepareUndo(); setUndoBatch(batch); await session.undo(batch); setUndoBatch(null); setCanUndo(false); setFinalizedCount((count) => Math.max(0, count - 1)); setNotice("Returned to Review.") }
    catch (err) { if ((err instanceof ApiError && err.status >= 400 && err.status < 500) || (err instanceof Error && /CONFLICT|409/.test(err.message))) setUndoBatch(null); setError(message(err)) } finally { setBusy(false) }
  }
  if (!enabled) return <main className="mx-auto max-w-lg p-6"><p>Review is unavailable.</p><Link href="/" className="underline">Back to Overview</Link></main>
  return <div className="min-h-screen bg-background pb-mobile-nav"><Header /><main className="mx-auto max-w-lg space-y-8 px-5 pt-standalone-safe-top pb-8">
    <header><p className="text-sm text-muted-foreground">Capture now, organize later</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{api.pendingCaptureEnabled ? "Quick Capture" : "Review"}</h1></header>
    {api.pendingCaptureEnabled && <QuickCapture authority={authority} busy={busy} setBusy={setBusy} onError={setError} onNotice={setNotice} />}
    {!api.pendingRecoveryEnabled && api.pendingGlobalCount > 0 && <p role="alert">Review is temporarily unavailable. Your pending expenses remain encrypted; reconnect or contact support to restore Review.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error} <button className="underline" onClick={() => void api.syncFinancialState().catch(() => setError("Sync failed. Try again."))}>Sync</button></p>}
    {notice && <p role="status" className="text-sm">{notice} {canUndo && <button onClick={() => void undo()} disabled={busy} className="font-semibold underline">Undo</button>}</p>}
    <section className="space-y-4 border-t border-border pt-6"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold tracking-tight">Review</h2>{authority && !api.isLoading && <span className="text-sm text-muted-foreground">{queue.length} pending</span>}</div>
      {authority && !api.isLoading && <p className="text-sm text-muted-foreground" aria-label="Review progress">{finalizedCount} finalized · {queue.filter((item) => skipped.has(item.id)).length} skipped</p>}
      {!authority || api.isLoading ? <p className="text-sm text-muted-foreground">Unlock your Vault to view pending transactions.</p> : !current ? <p className="text-sm text-muted-foreground">{queue.length ? "You’ve reached the end of this pass." : finalizedCount > 0 ? "Review complete." : "Nothing to review yet."} {queue.length > 0 && <button className="underline" onClick={() => setSkipped(new Set())}>Review skipped items</button>}</p> : authority && session && deps && api.pendingRecoveryEnabled ? <ReviewItem key={`${current.id}:${authority.store.get(current.id)?.envelope.record_revision}`} item={current} authority={authority} session={session} references={references} busy={busy} setBusy={setBusy} onSkip={() => setSkipped((old) => new Set([...old, current.id]))} onDone={() => { setFinalizedCount((count) => count + 1); setNotice("Transaction finalized."); setCanUndo(true); setUndoBatch(null); setError("") }} onError={setError} onTagCreated={(tag) => setReferences((old) => ({ ...old, tags: [...old.tags, tag] }))} getSuggestions={api.getTransactionSuggestions} createTag={api.createTag} reopen={api.reopenMonth} /> : null}
    </section>
  </main><BottomNav /></div>
}
