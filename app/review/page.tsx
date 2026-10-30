"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ApiError } from "@/lib/api/core"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { PendingReviewSession, reconcilePendingFinalization } from "@/lib/privacy/encrypted-authority/pending-lifecycle"
import type { Card, Context, Tag } from "@/lib/api/types"
import { ReviewItem } from "@/components/review/review-item"
import { message } from "@/components/review/review-ui"
import { QuickCapture } from "@/components/review/quick-capture"
import { useAuth } from "@/components/auth/auth-provider"
import { rememberReview, getRememberedReview, clearRememberedReview } from "@/components/review/review-recovery"
import { useInterfacePreference } from "@/components/layout/interface-preference"
import type { PendingTransaction } from "@/lib/domain/financial/pending-transactions"
import styles from "@/components/review/v2-review.module.css"
import type { PreparedSourceBatch } from "@/lib/privacy/encrypted-authority/authority"

export default function ReviewPage() {
  const api = useFinancialAuthority()
  const { version } = useInterfacePreference()
  const { profile } = useAuth()
  const accountId = profile?.id ?? ""
  const [recoveryId, setRecoveryId] = useState<string | null>(null)
  const [protectedItem, setProtectedItem] = useState<PendingTransaction | null>(null)
  const [reviewEpoch, setReviewEpoch] = useState(0)
  const [finalizedCount, setFinalizedCount] = useState(0)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [undoBatch, setUndoBatch] = useState<PreparedSourceBatch | null>(null)
  const undoUncertain = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [finalizationPending, setFinalizationPending] = useState(false)
  const [references, setReferences] = useState<{ tags: Tag[]; cards: Card[]; contexts: Context[] }>({ tags: [], cards: [], contexts: [] })
  const authority = api.authority
  const authorityVersion = authority?.getVersion()
  const enabled = api.pendingCaptureEnabled || api.pendingGlobalCount > 0 || canUndo || Boolean(protectedItem) || Boolean(recoveryId)
  const session = useMemo(() => authority ? new PendingReviewSession({ authority, isAuthenticated: true }) : null, [authority])
  useEffect(() => { setSkipped(new Set()); setFinalizedCount(0); setCanUndo(false); setUndoBatch(null); undoUncertain.current = false; setProtectedItem(null); setFinalizationPending(false) }, [authority])
  useEffect(() => {
    if (!authority || !enabled) return
    let active = true
    void api.getTransactionReferences().then((refs) => { if (active) setReferences(refs) }).catch(() => { if (active) setError("Could not load tags and account details.") })
    return () => { active = false }
  }, [authority, authorityVersion, enabled, api.getTransactionReferences])
  const queue = authority ? [...authority.getState().pendingTransactions].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id)) : []
  const current = protectedItem ?? queue.find((item) => !skipped.has(item.id))
  useEffect(() => { if (version === "v2" && api.pendingRecoveryEnabled && current && !protectedItem) setProtectedItem(current) }, [version, api.pendingRecoveryEnabled, current, protectedItem])
  const skippedCount = queue.filter((item) => skipped.has(item.id)).length
  const total = finalizedCount + queue.length + (protectedItem && !queue.some(item => item.id === protectedItem.id) ? 1 : 0)
  const position = current ? Math.min(total, finalizedCount + skippedCount + 1) : finalizedCount + skippedCount
  const deps = authority ? { authority, isAuthenticated: true } : null
  useEffect(() => { if (!authority || !accountId) return; const id = getRememberedReview(accountId); if (id) setRecoveryId(id) }, [authority, accountId])
  async function checkRecovery() {
    if (!authority || !recoveryId || busy) return
    setBusy(true)
    try {
      const result = await reconcilePendingFinalization({ authority, isAuthenticated: true }, recoveryId)
      if (result === "finalized") { clearRememberedReview(accountId, recoveryId); setRecoveryId(null); setProtectedItem(null); setError(""); setNotice("The previous review was confirmed.") }
      else setError("The previous review outcome is still uncertain. Sync again before continuing.")
    } catch { setError("Unable to check the previous review. Sync again before continuing.") }
    finally { setBusy(false) }
  }
  async function undo() {
    if (!session || busy) return
    setBusy(true); setError("")
    try { const batch = undoBatch ?? await session.prepareUndo(); setUndoBatch(batch); await session.undo(batch); undoUncertain.current = false; setUndoBatch(null); setCanUndo(false); setFinalizedCount((count) => Math.max(0, count - 1)); setNotice("Returned to Review.") }
    catch (err) { const definite = (err instanceof ApiError && err.status >= 400 && err.status < 500) || (err instanceof Error && /CONFLICT|409/.test(err.message)); if (definite && !undoUncertain.current) setUndoBatch(null); else if (!definite) undoUncertain.current = true; setError(message(err)) } finally { setBusy(false) }
  }
  if (!enabled) return <main className="mx-auto max-w-lg p-6"><p>Review is unavailable.</p><Link href="/" className="underline">Back to Overview</Link></main>
  return <div className="min-h-screen bg-background pb-mobile-nav"><Header /><main className="mx-auto max-w-lg space-y-8 px-5 pt-standalone-safe-top pb-8"><div className={version === "v2" ? `${styles.root} ${styles.page}` : "space-y-8"}>
    {version === "classic" ? <header><p className="text-sm text-muted-foreground">Capture now, organize later</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{api.pendingCaptureEnabled ? "Quick Capture" : "Review"}</h1></header> : <div className={styles.progress}><h1>Review</h1><span>{current ? `${position} of ${total}` : `${finalizedCount} finalized`} · {skippedCount} skipped</span></div>}
    {version === "v2" && total > 0 && <div className={styles.track} role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(finalizedCount, total)} aria-valuetext={`${finalizedCount} finalized, ${skippedCount} skipped`}><span style={{ width: `${Math.min(100, finalizedCount / total * 100)}%` }} /></div>}
    {version === "classic" && api.pendingCaptureEnabled && <QuickCapture authority={authority} busy={busy} setBusy={setBusy} onError={setError} onNotice={setNotice} />}
    {!api.pendingRecoveryEnabled && api.pendingGlobalCount > 0 && <p role="alert">Review is temporarily unavailable. Your pending expenses remain encrypted; reconnect or contact support to restore Review.</p>}
    {recoveryId && <p role="alert">A previous review has an uncertain outcome. <button type="button" className="underline" disabled={busy} onClick={() => void checkRecovery()}>Check previous review</button></p>}
    {error && <p role="alert" className="text-sm text-destructive">{error} <button className="underline" onClick={() => void api.syncFinancialState().catch(() => setError("Sync failed. Try again."))}>Sync</button></p>}
    {notice && <p role="status" className="text-sm">{notice} {canUndo && <button onClick={() => void undo()} disabled={busy || finalizationPending || !api.pendingRecoveryEnabled} className="font-semibold underline">Undo</button>}</p>}
    <section className={version === "v2" ? "space-y-4" : "space-y-4 border-t border-border pt-6"}><div className="flex items-center justify-between">{version === "classic" && <h2 className="text-2xl font-semibold tracking-tight">Review</h2>}{authority && !api.isLoading && <span className="text-sm text-muted-foreground">{queue.length} pending</span>}</div>
      {version === "classic" && authority && !api.isLoading && <p className="text-sm text-muted-foreground" aria-label="Review progress">{finalizedCount} finalized · {queue.filter((item) => skipped.has(item.id)).length} skipped</p>}
      {!authority || api.isLoading ? <p className="text-sm text-muted-foreground">Unlock your Vault to view pending transactions.</p> : !current ? (version === "v2" ? <div className={styles.complete}><h2>{queue.length ? "Only skipped left" : finalizedCount > 0 ? "All caught up" : "Nothing to review"}</h2><p className={styles.muted}>{finalizedCount} finalized · {skippedCount} skipped</p>{queue.length > 0 && <button type="button" className={styles.link} onClick={() => setSkipped(new Set())}>Review skipped items</button>}<Link className={styles.link} href="/">Back to Overview</Link></div> : <p className="text-sm text-muted-foreground">{queue.length ? "You’ve reached the end of this pass." : finalizedCount > 0 ? "Review complete." : "Nothing to review yet."} {queue.length > 0 && <button className="underline" onClick={() => setSkipped(new Set())}>Review skipped items</button>}</p>) : authority && session && deps && (api.pendingRecoveryEnabled || finalizationPending || (version === "v2" && Boolean(protectedItem))) ? <ReviewItem key={`${current.id}:${reviewEpoch}`} item={current} authority={authority} session={session} references={references} busy={busy || Boolean(undoBatch) || Boolean(recoveryId) || (version === "classic" && !api.pendingRecoveryEnabled)} setBusy={setBusy} onSkip={() => { setProtectedItem(null); setSkipped((old) => new Set([...old, current.id])) }} onDone={() => { clearRememberedReview(accountId, current.id); setFinalizationPending(false); setProtectedItem(null); setFinalizedCount((count) => count + 1); setNotice("Transaction finalized."); setCanUndo(true); setUndoBatch(null); setError("") }} onError={setError} onTagCreated={(tag) => setReferences((old) => ({ ...old, tags: [...old.tags.filter((existing) => existing.id !== tag.id), tag] }))} getSuggestions={api.getTransactionSuggestions} createTag={api.createTag} reopen={api.reopenMonth} onPreparedChange={(value) => { setFinalizationPending(value); if (value) rememberReview(accountId, current.id); else clearRememberedReview(accountId, current.id) }} onReload={() => { setProtectedItem(null); setReviewEpoch((n) => n + 1); void api.syncFinancialState().catch(() => setError("Sync failed. Try again.")) }} /> : null}
    </section>
  </div></main><BottomNav /></div>
}
