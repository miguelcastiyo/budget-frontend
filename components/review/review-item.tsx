"use client"

import { useEffect, useState } from "react"
import { ApiError } from "@/lib/api/core"
import { isClosedCloseout } from "@/lib/privacy/encrypted-authority/pending-summary"
import { PendingReviewSession } from "@/lib/privacy/encrypted-authority/pending-lifecycle"
import type { PendingTransaction } from "@/lib/domain/financial/pending-transactions"
import { formatMoneyCents } from "@/lib/domain/financial/money"
import type { Card, Context, Tag } from "@/lib/api/types"
import type { EncryptedFinancialAuthority, PreparedSourceBatch } from "@/lib/privacy/encrypted-authority/authority"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { ReviewSwipeCard } from "./review-swipe-card"
import { field, button, secondary, message } from "./review-ui"

type ReviewProps = { item: PendingTransaction; authority: EncryptedFinancialAuthority; session: PendingReviewSession; references: { tags: Tag[]; cards: Card[]; contexts: Context[] }; busy: boolean; setBusy: (value: boolean) => void; onSkip: () => void; onDone: () => void; onError: (value: string) => void; onTagCreated: (tag: Tag) => void; getSuggestions: ReturnType<typeof useFinancialAuthority>["getTransactionSuggestions"]; createTag: ReturnType<typeof useFinancialAuthority>["createTag"]; reopen: ReturnType<typeof useFinancialAuthority>["reopenMonth"] }
export function ReviewItem({ item, authority, session, references, busy, setBusy, onSkip, onDone, onError, onTagCreated, getSuggestions, createTag, reopen }: ReviewProps) {
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
  const selectCategory = (value: PendingTransaction["category"]) => { if (value) { setCategory(value); setConfirmed(false) } }
  return <form onSubmit={finalize} className="space-y-4 motion-safe:animate-[review-enter_180ms_ease-out]" aria-label="Review transaction">
    <ReviewSwipeCard amount={amount} description={description} date={date} category={category} disabled={busy || Boolean(prepared)} onSelect={selectCategory} />
    <fieldset disabled={busy || Boolean(prepared)} className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Amount<input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Required" /></label><label className="text-sm font-medium">Date<input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label></div>
    <label className="block text-sm font-medium">Description<input className={field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Required" /></label>
    <fieldset><legend className="mb-2 text-sm font-medium">Category</legend><div className="grid grid-cols-3 gap-2">{["needs", "wants", "savings"].map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => selectCategory(value as PendingTransaction["category"])} className={`${secondary} capitalize ${category === value ? "border-primary bg-primary/10" : ""}`}>{value}</button>)}</div></fieldset>
    {category && <div className="space-y-2"><label className="block text-sm font-medium">Tag<select className={field} value={tag} onChange={(e) => { setTag(e.target.value); setConfirmed(Boolean(e.target.value)) }}><option value="">Choose a tag</option>{references.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{suggested && !confirmed && <button type="button" className="text-sm underline" onClick={() => { setTag(suggested.id); setConfirmed(true) }}>Use suggested tag: {suggested.name}</button>}{tag && !confirmed && <button type="button" className="text-sm underline" onClick={() => setConfirmed(true)}>Confirm selected tag</button>}<div className="flex gap-2"><input className={field} value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="New tag" aria-label="New tag name" /><button type="button" className={secondary} onClick={() => void addTag()} disabled={busy}>Add</button></div></div>}
    <details><summary className="cursor-pointer py-2 text-sm font-medium">More details</summary><div className="space-y-3 pt-2"><label className="block text-sm">Card<select className={field} value={card} onChange={(e) => setCard(e.target.value)}><option value="">None</option>{references.cards.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="block text-sm">Context<select className={field} value={context} onChange={(e) => setContext(e.target.value)}><option value="">None</option>{references.contexts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Split expense</label><label className="block text-sm">Notes<textarea className={field} value={notes} onChange={(e) => setNotes(e.target.value)} /></label></div></details>
    </fieldset>{prepared && <p className="text-sm text-muted-foreground">Finalization may have succeeded. Retry to confirm its result.</p>}
    {closed && <p className="text-sm text-amber-700">This month is closed. <button type="button" className="underline" disabled={busy} onClick={async () => { setBusy(true); try { await reopen(date.slice(0, 7)) } catch (err) { onError(message(err)) } finally { setBusy(false) } }}>Reopen month</button> before finalizing.</p>}
    <div className="flex gap-3"><button className={button} disabled={busy || closed}>Finalize</button><button type="button" className={secondary} disabled={busy || Boolean(prepared)} onClick={onSkip}>Skip</button></div>
  </form>
}
