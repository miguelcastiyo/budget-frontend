"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { MonthSelector } from "@/components/budget/month-selector"
import { formatSavingsCurrency } from "@/lib/formatters"
import { formatMonthLabel, formatMonthValue, getCurrentMonthKey } from "@/lib/date-filters"
import { useReplaceSavingsPlan, useSavingsPlan } from "@/lib/savings-plan"
import type { SavingsPlanFundItem } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"

function amount(value: string | null | undefined) {
  return Number.parseFloat(value ?? "0") || 0
}

function MoneyProgress({ value, target, label, compactSummary = false }: { value: string; target: string; label?: string; compactSummary?: boolean }) {
  const percent = target && amount(target) > 0 ? Math.min((amount(value) / amount(target)) * 100, 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold tracking-tight">{compactSummary ? <>{formatSavingsCurrency(value)} <span className="font-normal text-muted-foreground">saved · {formatSavingsCurrency(target)} budgeted</span></> : <>{formatSavingsCurrency(value)} <span className="font-normal text-muted-foreground">of {formatSavingsCurrency(target)}</span></>}</span>
        {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Savings progress">
        <div className="h-full rounded-full bg-savings transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function PaceHint({ item, onUse }: { item: SavingsPlanFundItem; onUse?: () => void }) {
  const pace = item.pace
  if (pace.status === "on_track_calculable" && pace.recommended_amount) {
    return <p className="text-sm text-muted-foreground">To stay on pace: {formatSavingsCurrency(pace.recommended_amount)} this month {onUse ? <button type="button" className="ml-1 font-medium text-foreground underline underline-offset-4" onClick={onUse}>Use amount</button> : null}</p>
  }
  if (pace.status === "goal_met") return <p className="text-sm text-muted-foreground">Goal reached</p>
  if (pace.status === "overdue" && pace.goal_shortfall) return <p className="text-sm text-muted-foreground">Target was earlier · {formatSavingsCurrency(pace.goal_shortfall)} remaining</p>
  return null
}

function FundPlanRow({ item, editing, value, onChange, onRemove }: { item: SavingsPlanFundItem; editing?: boolean; value?: string; onChange?: (value: string) => void; onRemove?: () => void }) {
  return (
    <div className="space-y-2 border-b border-border/70 py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{item.fund.name}</p>
          {editing ? <p className="mt-1 text-sm text-muted-foreground">Planned for this month</p> : null}
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input aria-label={`Planned amount for ${item.fund.name}`} inputMode="decimal" className="h-10 w-28 text-right" value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
            <Button type="button" size="icon" variant="ghost" className="rounded-full text-muted-foreground" aria-label={`Remove ${item.fund.name} from Savings Plan`} onClick={onRemove}><Trash2 className="size-4" /></Button>
          </div>
        ) : <span className="font-semibold">{formatSavingsCurrency(item.planned_amount)}</span>}
      </div>
      {!editing ? <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground"><span>{formatSavingsCurrency(item.planned_amount)} planned</span><span className="shrink-0 font-medium text-foreground">{formatSavingsCurrency(item.progress_amount)} directed</span></div> : null}
    </div>
  )
}

export function SavingsPlanInlineSummary({ month = getCurrentMonthKey() }: { month?: string }) {
  const financialAuthority = useFinancialAuthority()
  if (financialAuthority.isLoading) return null
  const { data, isLoading } = useSavingsPlan(month)
  if (isLoading) return <div className="space-y-3 border-y border-border/70 py-5"><div className="h-3 w-24 animate-pulse rounded bg-muted" /><div className="h-7 w-44 animate-pulse rounded bg-muted" /></div>
  if (!data) return null
  const budget = data.budget.savings_budget
  const monthName = formatMonthValue(month, { month: "long" }) ?? month
  return (
    <section className="space-y-3 border-y border-border/70 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">This month</p>
      {!budget ? <><p className="font-semibold">No Savings budget for {monthName}</p><Button asChild variant="outline" size="sm" className="rounded-full"><Link href="/settings/budget">Set budget</Link></Button></> : <>
        <MoneyProgress value={data.summary.saved_amount} target={budget} compactSummary label={data.summary.over_saved_amount !== "0.00" ? `${formatSavingsCurrency(data.summary.over_saved_amount)} over` : undefined} />
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{amount(data.summary.unassigned_budget) > 0 ? `${formatSavingsCurrency(data.summary.unassigned_budget)} available to assign` : "Fully assigned"}</span><Button asChild variant="outline" size="sm" className="shrink-0 rounded-full"><Link href={`/funds/savings-plan?month=${month}`}>{data.has_plan ? "View plan" : `Plan ${formatMonthValue(month, { month: "long" }) ?? month}`}</Link></Button></div>
      </>}
    </section>
  )
}

export function SavingsPlanFundContext({ fundId, month = getCurrentMonthKey() }: { fundId: string; month?: string }) {
  const financialAuthority = useFinancialAuthority()
  if (financialAuthority.isLoading) return null
  const { data, isLoading } = useSavingsPlan(month)
  const item = data?.funds.find((entry) => entry.fund.id === fundId)
  if (isLoading || !item) return null
  const monthName = formatMonthValue(month, { month: "long" }) ?? month
  const contributed = amount(item.progress_amount)
  const planned = amount(item.planned_amount)
  const planStatus = planned === 0
    ? `No ${monthName} amount planned`
    : amount(item.over_plan_amount) > 0
      ? `${formatSavingsCurrency(item.over_plan_amount)} above plan`
      : amount(item.remaining_planned) > 0
        ? `${formatSavingsCurrency(item.remaining_planned)} remaining toward plan`
        : "Plan met"

  return <section className="space-y-3 border-y border-border/70 py-5"><p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">This month</p>{contributed > 0 ? <p className="text-xl font-semibold tracking-tight">{formatSavingsCurrency(item.progress_amount)} contributed</p> : <p className="text-sm text-muted-foreground">No {monthName} contributions</p>}{planned > 0 ? <p className="text-sm text-muted-foreground">{formatSavingsCurrency(item.planned_amount)} planned for {monthName}</p> : <p className="text-sm text-muted-foreground">{planStatus}</p>}{planned > 0 ? <p className="text-sm font-medium text-foreground">{planStatus}</p> : null}<PaceHint item={item} /><Link className="inline-block text-sm font-medium underline underline-offset-4" href={`/funds/savings-plan?month=${month}`}>View Savings Plan →</Link></section>
}

export function SavingsPlanPage({ initialMonth }: { initialMonth?: string }) {
  const [month, setMonth] = useState(initialMonth || getCurrentMonthKey())
  const { data, isLoading, error, refetch } = useSavingsPlan(month)
  const { replace, isSaving, error: saveError } = useReplaceSavingsPlan(month)
  const financialAuthority = useFinancialAuthority()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [activeFunds, setActiveFunds] = useState<SavingsPlanFundItem[]>([])

  const startEditing = () => {
    setDraft(Object.fromEntries((data?.funds ?? []).filter((item) => amount(item.planned_amount) > 0).map((item) => [item.fund.id, item.planned_amount])))
    setEditing(true)
  }
  const draftTotal = useMemo(() => Object.values(draft).reduce((sum, value) => sum + amount(value), 0), [draft])
  const budget = amount(data?.budget.savings_budget)
  const overBy = Math.max(draftTotal - budget, 0)
  const save = async () => {
    if (overBy > 0) return
    const next = await replace({ allocations: Object.entries(draft).filter(([, value]) => amount(value) > 0).map(([fund_id, value]) => ({ fund_id, amount: amount(value).toFixed(2) })) })
    if (next) { setEditing(false); setShowAdd(false); await refetch() }
  }
  const openAdd = async () => {
    const result = await financialAuthority.getFunds({ status: "active" })
    setActiveFunds(result.items.map((fund) => ({ fund: { id: fund.id, name: fund.name, status: fund.status, goal_amount: fund.goal_amount, target_month: fund.target_month, current_balance: fund.current_balance }, planned_amount: "0.00", transaction_contributed: "0.00", closeout_contributed: "0.00", progress_amount: "0.00", remaining_planned: "0.00", over_plan_amount: "0.00", pace: { status: "unavailable", planning_basis_balance: null, goal_shortfall: null, months_remaining: null, recommended_amount: null } })))
    setShowAdd(true)
  }

  return <div className="min-h-screen bg-background pb-mobile-nav"><main className="mx-auto max-w-lg px-5 pb-10 pt-standalone-safe-top lg:max-w-3xl lg:px-8">
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3"><Button variant="ghost" size="sm" className="rounded-full px-3" asChild><Link href="/insights/funds"><ArrowLeft className="size-4" />Funds</Link></Button>{data?.is_editable && data.has_plan && !editing ? <Button variant="outline" className="rounded-full" onClick={startEditing}><Pencil className="size-4" />Edit plan</Button> : null}</div>
      <div className="space-y-3"><p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Savings Plan</p><MonthSelector currentMonth={month} onChange={(next) => { setEditing(false); setMonth(next) }} allowFuture /></div>
      {isLoading ? <div className="space-y-4 py-10"><Spinner className="size-5" /><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="h-20 animate-pulse rounded bg-muted" /></div> : error || !data ? <div className="space-y-3 border-y border-border/70 py-6"><p className="text-sm text-destructive">{error ?? "Unable to load Savings Plan"}</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div> : !data.budget.has_budget ? <div className="space-y-3 border-y border-border/70 py-6"><p className="text-xl font-semibold">{formatMonthLabel(month) ?? month} doesn’t have a budget yet.</p><p className="text-sm text-muted-foreground">Set your monthly Savings amount first, then decide where you want it to go.</p><Button asChild><Link href="/settings/budget">Set monthly budget →</Link></Button></div> : editing ? <>
        <section className="space-y-4 border-y border-border/70 py-5"><div className="flex justify-between"><span className="text-sm text-muted-foreground">Available</span><span className="font-semibold">{formatSavingsCurrency(data.budget.savings_budget ?? "0")}</span></div>{Object.keys(draft).length === 0 ? <p className="text-sm text-muted-foreground">No Funds selected yet.</p> : Object.entries(draft).map(([id, value]) => { const item = data.funds.find((entry) => entry.fund.id === id) ?? activeFunds.find((entry) => entry.fund.id === id); if (!item) return null; return <FundPlanRow key={id} item={item} editing value={value} onChange={(next) => setDraft((current) => ({ ...current, [id]: next }))} onRemove={() => setDraft((current) => { const next = { ...current }; delete next[id]; return next })} /> })}<button type="button" className="flex items-center gap-2 text-sm font-medium" onClick={() => void openAdd()}><Plus className="size-4" />Add a fund</button></section>
        <div className="flex items-center justify-between text-sm"><span>Planned {formatSavingsCurrency(draftTotal)}</span><span className={cn(overBy > 0 ? "font-medium text-destructive" : "text-muted-foreground")}>{overBy > 0 ? `${formatSavingsCurrency(overBy)} over your ${formatMonthLabel(month) ?? month} Savings budget` : `${formatSavingsCurrency(Math.max(budget - draftTotal, 0))} not assigned`}</span></div>
        {showAdd ? <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4"><p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Add to Savings Plan</p>{activeFunds.filter((item) => !draft[item.fund.id]).map((item) => <button key={item.fund.id} type="button" className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-muted/50" onClick={() => { setDraft((current) => ({ ...current, [item.fund.id]: "0.00" })); setShowAdd(false) }}><span>{item.fund.name}</span><Plus className="size-4 text-muted-foreground" /></button>)}{activeFunds.filter((item) => !draft[item.fund.id]).length === 0 ? <p className="text-sm text-muted-foreground">All active Funds are already in this draft.</p> : null}</div> : null}
        <div className="flex gap-3"><Button className="flex-1 rounded-full" disabled={isSaving || overBy > 0} onClick={() => void save()}>{isSaving ? "Saving…" : "Save plan"}</Button><Button variant="outline" className="rounded-full" onClick={() => setEditing(false)}>Cancel</Button></div>{saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
      </> : <>
        <section className="space-y-4 border-y border-border/70 py-5"><MoneyProgress value={data.summary.saved_amount} target={data.budget.savings_budget ?? "0"} label={data.summary.over_saved_amount !== "0.00" ? `${formatSavingsCurrency(data.summary.over_saved_amount)} above budget` : `${formatSavingsCurrency(data.summary.remaining_to_save)} left to save`} />{data.summary.is_overallocated ? <p className="text-sm text-muted-foreground">Plan needs review · {formatSavingsCurrency(data.summary.overallocation_amount)} over budget</p> : null}</section>
        <section className="border-b border-border/70 pb-5"><p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Your plan</p>{data.has_plan ? <><div className="mt-1">{data.funds.filter((item) => amount(item.planned_amount) > 0).map((item) => <FundPlanRow key={item.fund.id} item={item} />)}</div><div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-4 text-sm text-muted-foreground"><span>{formatSavingsCurrency(data.summary.planned_to_funds)} planned</span><span>{formatSavingsCurrency(data.summary.unassigned_budget)} of Savings budget unassigned</span></div></> : <div className="space-y-3 pt-4"><p className="text-sm text-muted-foreground">You haven’t assigned {formatMonthLabel(month) ?? month}’s Savings budget to Funds yet.</p><p className="font-semibold">{formatSavingsCurrency(data.budget.savings_budget ?? "0")} available to assign</p>{data.is_editable ? <Button className="rounded-full" onClick={startEditing}>Plan savings</Button> : null}</div>}</section>
        {data.goal_pacing.status === "available" && data.goal_pacing.recommended_total && data.goal_pacing.gap_to_savings_budget && amount(data.goal_pacing.gap_to_savings_budget) > 0 ? <section className="border-b border-border/70 pb-5"><p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Goal pace</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Your target-date goals need about {formatSavingsCurrency(data.goal_pacing.recommended_total)} this month to stay on pace — {formatSavingsCurrency(data.goal_pacing.gap_to_savings_budget)} more than your {formatSavingsCurrency(data.budget.savings_budget ?? "0")} Savings budget.</p></section> : null}
        {data.funds.filter((item) => amount(item.planned_amount) === 0 && amount(item.progress_amount) > 0).length > 0 ? <section className="border-b border-border/70 pb-5"><p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Other Fund activity</p>{data.funds.filter((item) => amount(item.planned_amount) === 0 && amount(item.progress_amount) > 0).map((item) => <div key={item.fund.id} className="flex items-center justify-between gap-4 border-b border-border/70 py-4 text-sm last:border-b-0"><span className="min-w-0 truncate">{item.fund.name}<span className="block text-muted-foreground">No {formatMonthLabel(month) ?? month} allocation</span></span><span className="shrink-0 font-semibold">{formatSavingsCurrency(item.progress_amount)} directed</span></div>)}</section> : null}
        {data.status === "closed" ? <p className="text-sm text-muted-foreground">Closed</p> : null}
      </>}
    </div>
  </main></div>
}
