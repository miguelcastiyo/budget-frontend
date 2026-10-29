"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ApiError } from "@/lib/api/core"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { isClosedCloseout } from "@/lib/privacy/encrypted-authority/pending-summary"
import { pendingDevelopmentEnabled } from "@/lib/privacy/encrypted-authority/pending-development"
import { preparePendingTransaction, savePendingTransaction } from "@/lib/privacy/encrypted-authority/pending-transaction-operations"
import { PendingReviewSession } from "@/lib/privacy/encrypted-authority/pending-lifecycle"
import { type PendingTransaction } from "@/lib/domain/financial/pending-transactions"
import { FinancialDomainError } from "@/lib/domain/financial/errors"
import { formatMoneyCents } from "@/lib/domain/financial/money"
import { getLocalDateKey } from "@/lib/date-filters"
import type { Card, Context, Tag } from "@/lib/api/types"
import type { EncryptedFinancialAuthority, PreparedSourceBatch } from "@/lib/privacy/encrypted-authority/authority"

const field = "w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
const button = "rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
const secondary = "rounded-xl border border-border px-4 py-3 text-sm font-medium disabled:opacity-50"
function message(error: unknown): string {
  const text = error instanceof ApiError ? `${error.status} ${error.error.code} ${error.message}` : error instanceof Error ? error.message : ""
  if (text.includes("PENDING_MONTH_CLOSED")) return "This month is closed. Reopen it before finalizing."
  if (text.includes("CONFLICT") || text.includes("409")) return "This item changed on another device. Sync and review it again."
  if (text.includes("VALIDATION") || text.includes("validation")) return "Check the amount, description, category, and active tag."
  return "Could not save. Check your connection or unlock your Vault, then try again."
}
async function submit(authority: EncryptedFinancialAuthority, batch: PreparedSourceBatch) {
  try { await authority.submitPreparedSourceDiff(batch) } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error
    if (error instanceof Error && /409|CONFLICT|VALIDATION|DISABLED|LOCKED/.test(error.message)) throw error
    await authority.submitPreparedSourceDiff(batch)
  }
}

export default function ReviewPage() {
  const api = useFinancialAuthority()
  const [enabled, setEnabled] = useState(false)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(getLocalDateKey)
  const [captureBatch, setCaptureBatch] = useState<PreparedSourceBatch | null>(null)
  const [undoBatch, setUndoBatch] = useState<PreparedSourceBatch | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [references, setReferences] = useState<{ tags: Tag[]; cards: Card[]; contexts: Context[] }>({ tags: [], cards: [], contexts: [] })
  const authority = api.authority
  const authorityVersion = authority?.getVersion()
  const session = useMemo(() => authority ? new PendingReviewSession({ authority, isAuthenticated: true }) : null, [authority])
  useEffect(() => { setEnabled(pendingDevelopmentEnabled()) }, [])
  useEffect(() => { setSkipped(new Set()); setCanUndo(false); setCaptureBatch(null); setUndoBatch(null) }, [authority])
  useEffect(() => {
    if (!authority || !enabled) return
    let active = true
    void api.getTransactionReferences().then((refs) => { if (active) setReferences(refs) }).catch(() => { if (active) setError("Could not load tags and account details.") })
    return () => { active = false }
  }, [authority, authorityVersion, enabled, api.getTransactionReferences])
  const queue = authority ? [...authority.getState().pendingTransactions].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id)) : []
  const current = queue.find((item) => !skipped.has(item.id))
  const deps = authority ? { authority, isAuthenticated: true } : null
  async function capture(event: React.FormEvent) {
    event.preventDefault(); if (!authority || !deps || busy) return
    setBusy(true); setError(""); setNotice("")
    try {
      const batch = captureBatch ?? await savePendingTransaction(deps, preparePendingTransaction(deps, { amount, description, date }))
      setCaptureBatch(batch)
      await submit(authority, batch)
      setCaptureBatch(null); setAmount(""); setDescription(""); setDate(getLocalDateKey()); setNotice("Saved to Review.")
    } catch (err) { if (err instanceof ApiError && err.status >= 400 && err.status < 500) setCaptureBatch(null); setError(err instanceof FinancialDomainError ? "Enter a positive amount, a description, or both, and use a valid date." : message(err)) } finally { setBusy(false) }
  }
  async function undo() {
    if (!session || busy) return
    setBusy(true); setError("")
    try { const batch = undoBatch ?? await session.prepareUndo(); setUndoBatch(batch); await session.undo(batch); setUndoBatch(null); setCanUndo(false); setSkipped(new Set()); setNotice("Returned to Review.") }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  if (!enabled) return <main className="mx-auto max-w-lg p-6"><p>Review is unavailable.</p><Link href="/" className="underline">Back to Overview</Link></main>
  return <div className="min-h-screen bg-background pb-mobile-nav"><Header /><main className="mx-auto max-w-lg space-y-8 px-5 pt-standalone-safe-top pb-8">
    <header><p className="text-sm text-muted-foreground">Capture now, organize later</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Quick Capture</h1></header>
    <form onSubmit={capture} className="space-y-3" aria-label="Quick Capture">
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Amount<input className={field} inputMode="decimal" value={amount} disabled={Boolean(captureBatch)} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label><label className="text-sm font-medium">Date<input className={field} type="date" value={date} disabled={Boolean(captureBatch)} onChange={(e) => setDate(e.target.value)} /></label></div>
      <label className="block text-sm font-medium">Description<input className={field} value={description} disabled={Boolean(captureBatch)} onChange={(e) => setDescription(e.target.value)} placeholder="What was it?" /></label>
      <p className="text-xs text-muted-foreground">{captureBatch ? "The save outcome is uncertain. Retry to confirm it." : "Enter an amount, a description, or both."}</p><button className={button} disabled={busy || !authority}>Save expense</button>
      <Link href="/transactions?add=1" className="ml-4 text-sm underline">Full transaction entry</Link>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error} <button className="underline" onClick={() => void api.syncFinancialState().catch(() => setError("Sync failed. Try again."))}>Sync</button></p>}
    {notice && <p role="status" className="text-sm">{notice} {canUndo && <button onClick={() => void undo()} disabled={busy} className="font-semibold underline">Undo</button>}</p>}
    <section className="space-y-4 border-t border-border pt-6"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold tracking-tight">Review</h2>{authority && !api.isLoading && <span className="text-sm text-muted-foreground">{queue.length} pending</span>}</div>
      {!authority || api.isLoading ? <p className="text-sm text-muted-foreground">Unlock your Vault to view pending transactions.</p> : !current ? <p className="text-sm text-muted-foreground">{queue.length ? "You’ve reached the end of this pass." : "Nothing to review yet."} {queue.length > 0 && <button className="underline" onClick={() => setSkipped(new Set())}>Review skipped items</button>}</p> : authority && session && deps ? <ReviewItem key={`${current.id}:${authority.store.get(current.id)?.envelope.record_revision}`} item={current} authority={authority} deps={deps} session={session} references={references} busy={busy} setBusy={setBusy} onSkip={() => setSkipped((old) => new Set([...old, current.id]))} onDone={() => { setNotice("Transaction finalized."); setCanUndo(true); setUndoBatch(null); setError("") }} onError={setError} onTagCreated={(tag) => setReferences((old) => ({ ...old, tags: [...old.tags, tag] }))} getSuggestions={api.getTransactionSuggestions} createTag={api.createTag} reopen={api.reopenMonth} /> : null}
    </section>
  </main><BottomNav /></div>
}

type ReviewProps = { item: PendingTransaction; authority: EncryptedFinancialAuthority; deps: { authority: EncryptedFinancialAuthority; isAuthenticated: boolean }; session: PendingReviewSession; references: { tags: Tag[]; cards: Card[]; contexts: Context[] }; busy: boolean; setBusy: (value: boolean) => void; onSkip: () => void; onDone: () => void; onError: (value: string) => void; onTagCreated: (tag: Tag) => void; getSuggestions: ReturnType<typeof useFinancialAuthority>["getTransactionSuggestions"]; createTag: ReturnType<typeof useFinancialAuthority>["createTag"]; reopen: ReturnType<typeof useFinancialAuthority>["reopenMonth"] }
function ReviewItem({ item, authority, deps, session, references, busy, setBusy, onSkip, onDone, onError, onTagCreated, getSuggestions, createTag, reopen }: ReviewProps) {
  const [amount, setAmount] = useState(item.amountCents === null ? "" : formatMoneyCents(item.amountCents))
  const [description, setDescription] = useState(item.description ?? "")
  const [date, setDate] = useState(item.date)
  const [category, setCategory] = useState(item.category ?? "")
  const [tag, setTag] = useState(item.tagId ?? "")
  const [confirmed, setConfirmed] = useState(false)
  const [card, setCard] = useState(item.cardId ?? "")
  const [context, setContext] = useState(item.contextId ?? "")
  const [split, setSplit] = useState(item.isSplit ?? false)
  const [notes, setNotes] = useState(item.notes ?? "")
  const [tagName, setTagName] = useState("")
  const [suggested, setSuggested] = useState<Tag | null>(null)
  const [prepared, setPrepared] = useState<Awaited<ReturnType<PendingReviewSession["prepareFinalization"]>> | null>(null)
  const [revision] = useState(() => authority.store.get(item.id)?.envelope.record_revision)
  const closed = authority.getState().closeouts.some((c) => String(c.month ?? "").slice(0, 7) === date.slice(0, 7) && isClosedCloseout(c))
  useEffect(() => { let active = true; if (!description.trim() || !category) { setSuggested(null); return } void getSuggestions(description, 10).then((result) => { if (!active) return; const found = result.items.find((x) => x.category === category && references.tags.some((t) => t.id === x.tag.id)) ?? result.items.find((x) => references.tags.some((t) => t.id === x.tag.id)); setSuggested(found?.tag ?? null) }).catch(() => { if (active) setSuggested(null) }); return () => { active = false } }, [description, category, getSuggestions, references.tags])
  async function finalize(event: React.FormEvent) {
    event.preventDefault(); if (busy) return
    if (!confirmed || !references.tags.some((t) => t.id === tag)) { onError("Choose and confirm an active tag."); return }
    setBusy(true); onError("")
    try {
      let final = prepared
      if (!final) {
        final = await session.prepareFinalization(item.id, { amount, description, date, category: category as PendingTransaction["category"], tagId: tag, cardId: card || null, contextId: context || null, isSplit: split, notes }, revision)
        setPrepared(final)
      }
      try { await session.finalizePendingTransaction(final) } catch (err) { if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err; if (err instanceof Error && /409|CONFLICT|VALIDATION|CLOSED|DISABLED/.test(err.message)) throw err; await session.finalizePendingTransaction(final) }
      onDone()
    } catch (err) { if ((err instanceof ApiError && err.status >= 400 && err.status < 500) || (err instanceof Error && /409|CONFLICT|VALIDATION|CLOSED/.test(err.message))) setPrepared(null); onError(message(err)) } finally { setBusy(false) }
  }
  async function addTag() { if (!tagName.trim() || busy) return; setBusy(true); try { const created = await createTag({ name: tagName.trim() }); onTagCreated(created); setTag(created.id); setConfirmed(true); setTagName("") } catch (err) { onError(message(err)) } finally { setBusy(false) } }
  return <form onSubmit={finalize} className="space-y-4" aria-label="Review transaction">
    <fieldset disabled={busy || Boolean(prepared)} className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Amount<input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Required" /></label><label className="text-sm font-medium">Date<input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label></div>
    <label className="block text-sm font-medium">Description<input className={field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Required" /></label>
    <fieldset><legend className="mb-2 text-sm font-medium">Category</legend><div className="grid grid-cols-3 gap-2">{["needs", "wants", "savings"].map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setConfirmed(false) }} className={`${secondary} capitalize ${category === value ? "border-primary bg-primary/10" : ""}`}>{value}</button>)}</div></fieldset>
    {category && <div className="space-y-2"><label className="block text-sm font-medium">Tag<select className={field} value={tag} onChange={(e) => { setTag(e.target.value); setConfirmed(Boolean(e.target.value)) }}><option value="">Choose a tag</option>{references.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{suggested && !confirmed && <button type="button" className="text-sm underline" onClick={() => { setTag(suggested.id); setConfirmed(true) }}>Use suggested tag: {suggested.name}</button>}{tag && !confirmed && <button type="button" className="text-sm underline" onClick={() => setConfirmed(true)}>Confirm selected tag</button>}<div className="flex gap-2"><input className={field} value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="New tag" aria-label="New tag name" /><button type="button" className={secondary} onClick={() => void addTag()} disabled={busy}>Add</button></div></div>}
    <details><summary className="cursor-pointer py-2 text-sm font-medium">More details</summary><div className="space-y-3 pt-2"><label className="block text-sm">Card<select className={field} value={card} onChange={(e) => setCard(e.target.value)}><option value="">None</option>{references.cards.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="block text-sm">Context<select className={field} value={context} onChange={(e) => setContext(e.target.value)}><option value="">None</option>{references.contexts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Split expense</label><label className="block text-sm">Notes<textarea className={field} value={notes} onChange={(e) => setNotes(e.target.value)} /></label></div></details>
    </fieldset>{prepared && <p className="text-sm text-muted-foreground">Finalization may have succeeded. Retry to confirm its result.</p>}
    {closed && <p className="text-sm text-amber-700">This month is closed. <button type="button" className="underline" disabled={busy} onClick={async () => { setBusy(true); try { await reopen(date.slice(0, 7)) } catch (err) { onError(message(err)) } finally { setBusy(false) } }}>Reopen month</button> before finalizing.</p>}
    <div className="flex gap-3"><button className={button} disabled={busy || closed}>Finalize</button><button type="button" className={secondary} disabled={busy || Boolean(prepared)} onClick={onSkip}>Skip</button></div>
  </form>
}
