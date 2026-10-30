"use client"

import { useEffect, useRef, useState, type PointerEvent } from "react"
import type { FinancialCategory } from "@/lib/domain/financial/types"
import { reviewSwipeStartAllowed, reviewSwipeCategory } from "@/lib/review-swipe"
import { formatCurrency } from "@/lib/formatters"
import styles from "./v2-review.module.css"

const labels: Record<FinancialCategory, string> = { needs: "Needs", wants: "Wants", savings: "Savings" }
interface Props { amount: string; description: string; date: string; category: string; disabled: boolean; onSelect: (category: FinancialCategory) => void; v2?: boolean }

export function ReviewSwipeCard({ amount, description, date, category, disabled, onSelect, v2 = false }: Props) {
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [settling, setSettling] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const candidate = reviewSwipeCategory(offset.x, offset.y, 28)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  function start(event: PointerEvent<HTMLDivElement>) {
    if (disabled || settling || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || !reviewSwipeStartAllowed(event.clientX, window.innerWidth)) return
    if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a")) return
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return
    const x = event.clientX - pointer.current.x, y = event.clientY - pointer.current.y
    setOffset({ x: Math.max(-160, Math.min(160, x)), y: Math.max(-24, Math.min(160, y)) })
  }
  function finish(event: PointerEvent<HTMLDivElement>, canceled: boolean) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return
    const x = event.clientX - pointer.current.x, y = event.clientY - pointer.current.y
    pointer.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    const selected = canceled ? null : reviewSwipeCategory(x, y)
    if (!selected) { setOffset({ x: 0, y: 0 }); return }
    setSettling(true)
    setOffset(selected === "savings" ? { x: 0, y: 110 } : { x: selected === "needs" ? 110 : -110, y: 0 })
    setAnnouncement(`${labels[selected]} selected. Confirm a tag to continue.`)
    onSelect(selected)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    timer.current = setTimeout(() => { setOffset({ x: 0, y: 0 }); setSettling(false) }, reduced ? 0 : 180)
  }
  return <>
    <div data-testid="review-swipe-card" aria-label="Transaction swipe area" onPointerDown={start} onPointerMove={move} onPointerUp={(event) => finish(event, false)} onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={() => { if (pointer.current) { pointer.current = null; setDragging(false); setOffset({ x: 0, y: 0 }) } }}
      className={v2 ? `review-swipe-card ${styles.swipe}` : "review-swipe-card relative select-none rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-sm motion-reduce:!transition-none"}
      style={{ touchAction: "none", transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${Math.max(-5, Math.min(5, offset.x / 28))}deg)`, transition: dragging ? "none" : "transform 180ms ease-out", willChange: dragging ? "transform" : undefined }}>
      {v2 ? <><p className={styles.muted}>{date}</p><p className={styles.description}>{description || "Description needed"}</p><p className={styles.amount}>{amount ? formatCurrency(amount) : "Amount needed"}</p><p className={styles.muted}>{candidate ? labels[candidate] : "Right Needs · Left Wants · Down Savings"}</p></> : <><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{candidate ? labels[candidate] : category ? labels[category as FinancialCategory] : "Swipe to categorize"}</p><p className="mt-3 text-2xl font-semibold tracking-tight">{amount ? `$${amount}` : "Amount needed"}</p><p className="mt-1 text-sm text-foreground">{description || "Description needed"}</p><p className="mt-3 text-xs text-muted-foreground">{date} · Right Needs · Left Wants · Down Savings</p></>}
    </div>
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </>
}
