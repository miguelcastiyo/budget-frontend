"use client"

import { useState, type FormEvent } from "react"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { formatCurrency } from "@/lib/formatters"
import type { Card, Context, Tag } from "@/lib/api/types"
import type { FinancialCategory } from "@/lib/domain/financial/types"
import { ReviewSwipeCard } from "./review-swipe-card"
import styles from "./v2-review.module.css"

type Props = {
  amount: string; setAmount: (x: string) => void; description: string; setDescription: (x: string) => void
  date: string; setDate: (x: string) => void; category: string; selectCategory: (x: FinancialCategory) => void
  tag: string; setTag: (x: string) => void; card: string; setCard: (x: string) => void
  context: string; setContext: (x: string) => void; split: boolean; setSplit: (x: boolean) => void
  notes: string; setNotes: (x: string) => void; tagName: string; setTagName: (x: string) => void
  references: { tags: Tag[]; cards: Card[]; contexts: Context[] }; suggested: Tag | null; suggestedAlternatives: Tag[]
  stage: "category" | "tag"; setStage: (x: "category" | "tag") => void
  busy: boolean; prepared: boolean; closed: boolean; revisionChanged: boolean; recoveryEnabled: boolean
  addTag: () => void; onSkip: () => void; onFinalize: (event: FormEvent) => void; onReopen: () => void
  createCard: (name: string) => Promise<void>; createContext: (name: string) => Promise<void>
}

export function V2ReviewItem(p: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [allTags, setAllTags] = useState(false)
  const [search, setSearch] = useState("")
  const [newCard, setNewCard] = useState("")
  const [newContext, setNewContext] = useState("")
  const disabled = p.busy || p.prepared || !p.recoveryEnabled
  const choose = (category: FinancialCategory) => { p.selectCategory(category); p.setStage("tag") }
  const options = [p.suggested, ...p.suggestedAlternatives, ...p.references.tags].filter((tag, index, array): tag is Tag => Boolean(tag) && array.findIndex(item => item?.id === tag?.id) === index)
  const chosen = p.references.tags.find(tag => tag.id === p.tag)
  return <div className={styles.root}>
    <form aria-label="Review transaction" onSubmit={p.onFinalize}>
      {p.stage === "category" ? <>
        <ReviewSwipeCard v2 amount={p.amount} description={p.description} date={p.date} category={p.category} disabled={disabled} onSelect={choose} />
        {p.suggested && <p className={styles.muted}>Suggested tag: {p.suggested.name}</p>}
        <button type="button" className={styles.link} disabled={disabled} onClick={() => setEditOpen(true)}>Edit details</button>
        <div className={styles.categories} role="group" aria-label="Choose a category">
          <button type="button" disabled={disabled} onClick={() => choose("wants")}>← Wants</button><button type="button" disabled={disabled} onClick={() => choose("savings")}>↓ Savings</button><button type="button" disabled={disabled} onClick={() => choose("needs")}>Needs →</button>
        </div>
        <button type="button" className={styles.link} disabled={disabled} onClick={p.onSkip}>Skip for now</button>
      </> : <>
        <div className={styles.card}>
          <div className={styles.summary}><div><strong>{p.description || "Description needed"}</strong><p className={styles.muted}>{p.date}</p></div><span className={styles.summaryAmount}>{p.amount ? formatCurrency(p.amount) : "—"}</span></div>
          <span className={styles.categoryLabel}>{p.category}</span>
          <button type="button" className={styles.link} disabled={disabled} onClick={() => setEditOpen(true)}>Edit details</button>
          <p className={styles.muted}>{p.suggested ? "Suggested tag" : "Choose a tag"}</p>
          <div className={styles.tagList}>{[...(chosen && !options.slice(0, 4).some(t => t.id === chosen.id) ? [chosen] : []), ...options.slice(0, 4)].map(tag => <button type="button" key={tag.id} aria-pressed={p.tag === tag.id} disabled={disabled} onClick={() => p.setTag(tag.id)}>{tag.name}</button>)}<button type="button" disabled={disabled} onClick={() => setAllTags(true)}>All tags</button></div>
        </div>
        <button type="submit" className={styles.primary} disabled={p.busy || !p.recoveryEnabled || p.closed || !p.tag || (p.revisionChanged && !p.prepared)}>{p.prepared ? "Retry confirmation" : "Confirm & Next"}</button>
        <button type="button" className={styles.link} disabled={disabled} onClick={() => p.setStage("category")}>Change category</button>
        <button type="button" className={styles.link} disabled={disabled} onClick={p.onSkip}>Skip for now</button>
      </>}
      {p.revisionChanged && !p.prepared && <p role="alert">This item changed on another device. Sync and review it again before finalizing.</p>}
      {p.prepared && <p role="status">Finalization may have succeeded. Retry to confirm its result.</p>}
      {p.closed && <p role="alert">This month is closed. <button type="button" className={styles.link} disabled={p.busy || p.prepared || !p.recoveryEnabled} onClick={p.onReopen}>Reopen month</button> before finalizing.</p>}
    </form>
    <ResponsiveDialog open={editOpen} onOpenChange={(next) => { if (!p.busy && !p.prepared) setEditOpen(next) }} title="Edit details" contentClassName={styles.portal}>
      <fieldset disabled={disabled} className={styles.editFields}>
        <label>Amount<input className={styles.field} inputMode="decimal" value={p.amount} onChange={e => p.setAmount(e.target.value)} /></label>
        <label>Description<input className={styles.field} value={p.description} onChange={e => p.setDescription(e.target.value)} /></label>
        <label>Date<input className={styles.field} type="date" value={p.date} onChange={e => p.setDate(e.target.value)} /></label>
        <label>Category<select className={styles.field} value={p.category} onChange={e => { if (e.target.value) p.selectCategory(e.target.value as FinancialCategory) }}><option value="">Choose category</option><option value="needs">Needs</option><option value="wants">Wants</option><option value="savings">Savings</option></select></label>
        <label>Tag<select className={styles.field} value={p.tag} onChange={e => p.setTag(e.target.value)}><option value="">Choose tag</option>{p.references.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
        <label>Card<select className={styles.field} value={p.card} onChange={e => p.setCard(e.target.value)}><option value="">None</option>{p.references.cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
        <label>New card<input className={styles.field} value={newCard} onChange={e => setNewCard(e.target.value)} /></label><button type="button" className={styles.link} disabled={!newCard.trim()} onClick={() => { void p.createCard(newCard.trim()).then(() => setNewCard("")).catch(() => {}) }}>Create card</button>
        <label>Context<select className={styles.field} value={p.context} onChange={e => p.setContext(e.target.value)}><option value="">None</option>{p.references.contexts.map(context => <option key={context.id} value={context.id}>{context.name}</option>)}</select></label>
        <label>New context<input className={styles.field} value={newContext} onChange={e => setNewContext(e.target.value)} /></label><button type="button" className={styles.link} disabled={!newContext.trim()} onClick={() => { void p.createContext(newContext.trim()).then(() => setNewContext("")).catch(() => {}) }}>Create context</button>
        <label><span>Split expense <input type="checkbox" checked={p.split} onChange={e => p.setSplit(e.target.checked)} /></span></label>
        <label>Notes<textarea className={styles.field} value={p.notes} onChange={e => p.setNotes(e.target.value)} /></label>
        <button type="button" className={styles.primary} onClick={() => { if (p.category) p.setStage("tag"); setEditOpen(false) }}>Done</button>
      </fieldset>
    </ResponsiveDialog>
    <ResponsiveDialog open={allTags} onOpenChange={(next) => { if (!p.busy && !p.prepared) setAllTags(next) }} title="All tags" contentClassName={styles.portal}>
      <div className={styles.editFields}><label>Search tags<input className={styles.field} value={search} onChange={e => setSearch(e.target.value)} /></label>
        {p.references.tags.filter(tag => tag.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(tag => <button key={tag.id} type="button" className={styles.link} aria-pressed={p.tag === tag.id} onClick={() => { p.setTag(tag.id); setAllTags(false) }}>{tag.name}</button>)}
        <label>New tag name<input className={styles.field} value={p.tagName} onChange={e => p.setTagName(e.target.value)} /></label><button type="button" className={styles.primary} disabled={disabled || !p.tagName.trim()} onClick={p.addTag}>Create tag</button><button type="button" className={styles.link} disabled={disabled} onClick={() => setAllTags(false)}>Done</button>
      </div>
    </ResponsiveDialog>
  </div>
}
