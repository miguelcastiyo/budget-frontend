"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, ChevronDown, Pencil, Plus, RotateCcw, Wallet } from "lucide-react"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, apiClient } from "@/lib/api/client"
import {
  formatDateTimeValue,
  formatMonthLabel,
  formatMonthValue,
  getNextMonthKey,
} from "@/lib/date-filters"
import { formatCurrency } from "@/lib/formatters"
import {
  buildClosedSummary,
  buildFooterState,
  buildFooterStatus,
  formatCents,
  getAllocationCardTitle,
  getAllocationTypeLabel,
  getCloseoutOutcome,
  getDefaultAllocationLabel,
  getReceiptRows,
  inferCloseoutDecision,
  parseMoneyToCents,
  type CloseoutDecision,
  type CloseoutOutcome,
} from "@/lib/month-closeout"
import { cn } from "@/lib/utils"
import type {
  FundListItem,
  MonthCloseoutAllocation,
  MonthCloseoutAllocationInput,
  MonthCloseoutAllocationType,
  MonthCloseoutComputed,
  MonthCloseoutResponse,
  MonthCloseoutResultType,
  MonthCloseoutSaved,
} from "@/lib/api/types"

export type MonthCloseoutTrayMode = "close" | "view" | "edit" | "review"

interface MonthCloseoutTrayProps {
  open: boolean
  mode: MonthCloseoutTrayMode
  month: string
  closeout: MonthCloseoutResponse | null
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: MonthCloseoutTrayMode) => void
  onSaved: (closeout: MonthCloseoutResponse) => void
}

interface EditableAllocationRow {
  id: string
  allocation_type: MonthCloseoutAllocationType
  fund_id: string
  label: string
  amount: string
  target_month: string
  notes: string
}

interface TrayPresentation {
  title: string
  description: string
  isReview: boolean
  isReadOnly: boolean
}

const SURPLUS_TYPES: MonthCloseoutAllocationType[] = [
  "fund",
  "savings",
  "buffer",
  "rollover",
  "debt",
  "investment",
  "other",
]

function parseAmount(value: string | null | undefined): number {
  const amount = Number.parseFloat(value ?? "")
  return Number.isFinite(amount) ? amount : 0
}

function getResultAmount(resultType: MonthCloseoutResultType, source: MonthCloseoutComputed | MonthCloseoutSaved | null): number {
  if (!source) {
    return 0
  }

  if (resultType === "surplus") {
    return parseAmount(source.surplus_amount)
  }

  if (resultType === "deficit") {
    return parseAmount(source.deficit_amount)
  }

  return 0
}

function allocationToRow(allocation: MonthCloseoutAllocation): EditableAllocationRow {
  return {
    id: allocation.id,
    allocation_type: allocation.allocation_type,
    fund_id: allocation.fund_id ?? "",
    label: allocation.label ?? "",
    amount: allocation.amount,
    target_month: allocation.target_month ?? "",
    notes: allocation.notes ?? "",
  }
}

function createAllocationRow(month: string, type: MonthCloseoutAllocationType, amount = ""): EditableAllocationRow {
  return {
    id: `draft-${Math.random().toString(36).slice(2, 10)}`,
    allocation_type: type,
    fund_id: "",
    label: "",
    amount,
    target_month: type === "rollover" ? getNextMonthKey(month) : "",
    notes: "",
  }
}

function buildPayloadAllocations(rows: EditableAllocationRow[]): MonthCloseoutAllocationInput[] {
  return rows
    .filter((row) => parseAmount(row.amount) > 0)
    .map((row) => ({
      allocation_type: row.allocation_type,
      fund_id: row.allocation_type === "fund" ? row.fund_id || null : null,
      amount: row.amount,
      label: row.label.trim() || getDefaultAllocationLabel(row.allocation_type),
      target_month: row.allocation_type === "rollover" ? row.target_month || null : null,
      notes: row.notes.trim() || null,
    }))
}

function getTrayPresentation(mode: MonthCloseoutTrayMode, monthLabel: string): TrayPresentation {
  switch (mode) {
    case "review":
      return {
        title: "Closeout review",
        description: monthLabel,
        isReview: true,
        isReadOnly: false,
      }
    case "view":
      return {
        title: `${monthLabel} is closed`,
        description: "Month closeout",
        isReview: false,
        isReadOnly: true,
      }
    case "edit":
      return {
        title: "Month closeout",
        description: monthLabel,
        isReview: false,
        isReadOnly: false,
      }
    case "close":
    default:
      return {
        title: "Month closeout",
        description: monthLabel,
        isReview: false,
        isReadOnly: false,
      }
  }
}

export function MonthCloseoutTray({
  open,
  mode,
  month,
  closeout,
  onOpenChange,
  onModeChange,
  onSaved,
}: MonthCloseoutTrayProps) {
  const [notes, setNotes] = useState("")
  const [allocations, setAllocations] = useState<EditableAllocationRow[]>([])
  const [decision, setDecision] = useState<CloseoutDecision>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(true)
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [isFundsLoading, setIsFundsLoading] = useState(false)

  const computed = closeout?.computed ?? null
  const saved = closeout?.closeout ?? null
  const activeResultType = (mode === "close" ? computed?.result_type : saved?.result_type) ?? computed?.result_type ?? "balanced"
  const activeSource = mode === "close" ? computed : saved
  const resultAmount = getResultAmount(activeResultType, activeSource)
  const monthLabel = formatMonthLabel(month) ?? month
  const presentation = getTrayPresentation(mode, monthLabel)
  const outcome = getCloseoutOutcome(activeResultType)
  const receiptSource = computed
  const savedUnallocatedCents = parseMoneyToCents(saved?.unallocated_amount)

  const plannedTotalCents = parseMoneyToCents(receiptSource?.planned.total)
  const actualTotalCents = parseMoneyToCents(receiptSource?.actual.total)
  const resultAmountCents = parseMoneyToCents(resultAmount)
  const availableAllocationCents = outcome === "under" ? resultAmountCents : 0
  const allocatedTotalCents = useMemo(
    () => allocations.reduce((sum, allocation) => sum + parseMoneyToCents(allocation.amount), 0),
    [allocations]
  )
  const remainingAllocationCents = Math.max(availableAllocationCents - allocatedTotalCents, 0)
  const allocationTypeOptions = SURPLUS_TYPES
  const showDecisionSection = outcome === "under" && !presentation.isReadOnly
  const showAllocationEditor = showDecisionSection && decision !== null && decision !== "buffer"
  const canManageSurplusAllocations = outcome === "under"
  const primaryCtaLabel =
    mode === "edit"
      ? "Save closeout"
      : mode === "close" && (closeout?.status === "reopened" || saved?.is_stale)
        ? "Update closeout"
        : `Close ${formatMonthValue(month, { month: "long" }) ?? month}`

  useEffect(() => {
    if (!open) {
      return
    }

    const nextRows = saved?.allocations?.map(allocationToRow) ?? []
    setError(null)
    setNotes(saved?.notes ?? "")
    setAllocations(nextRows)
    setDecision(
      canManageSurplusAllocations
        ? inferCloseoutDecision(saved?.allocations, availableAllocationCents, savedUnallocatedCents)
        : null
    )
    if (typeof window !== "undefined") {
      setIsBreakdownExpanded(window.matchMedia("(min-width: 900px)").matches)
    }
  }, [open, saved, canManageSurplusAllocations, availableAllocationCents, savedUnallocatedCents])

  useEffect(() => {
    if (!open || !showDecisionSection) {
      return
    }

    let isActive = true
    setIsFundsLoading(true)

    void apiClient.getFunds({ status: "active", include_entries_summary: true })
      .then((response) => {
        if (isActive) {
          setFunds(response.items)
        }
      })
      .catch(() => {
        if (isActive) {
          setFunds([])
        }
      })
      .finally(() => {
        if (isActive) {
          setIsFundsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [open, showDecisionSection])

  const footerState = useMemo(() => {
    if (mode === "edit") {
      return {
        helperText: error ? "Could not save closeout changes" : buildFooterStatus({
          outcome,
          availableCents: availableAllocationCents,
          allocatedCents: allocatedTotalCents,
        }),
        buttonText: isSubmitting ? "Saving..." : primaryCtaLabel,
        disabled: allocatedTotalCents > availableAllocationCents || isSubmitting,
      }
    }

    return buildFooterState({
      monthLabel: formatMonthValue(month, { month: "long" }) ?? month,
      outcome,
      decision,
      availableCents: outcome === "over" ? resultAmountCents : availableAllocationCents,
      allocatedCents: allocatedTotalCents,
      isSubmitting,
      hasError: Boolean(error),
    })
  }, [mode, error, outcome, availableAllocationCents, allocatedTotalCents, isSubmitting, primaryCtaLabel, month, decision, resultAmountCents])

  const validateForm = (): boolean => {
    if (!canManageSurplusAllocations) {
      return true
    }

    if (allocatedTotalCents > availableAllocationCents) {
      setError("Allocations cannot exceed the extra left this month.")
      return false
    }

    for (const row of allocations) {
      const amount = parseAmount(row.amount)
      const hasOtherValues = Boolean(
        row.label.trim() || row.notes.trim() || row.target_month.trim() || row.allocation_type
      )

      if (!hasOtherValues && amount <= 0) {
        continue
      }

      if (amount <= 0) {
        setError("Each allocation needs an amount greater than zero.")
        return false
      }

      if (row.allocation_type === "rollover" && !row.target_month.trim()) {
        setError("Rollover allocations need a target month.")
        return false
      }

      if (row.allocation_type === "fund" && !row.fund_id.trim()) {
        setError("Fund allocations need a fund.")
        return false
      }
    }

    return true
  }

  const submitForm = async () => {
    if (!closeout || !validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        notes: notes.trim() || null,
        allocations: buildPayloadAllocations(allocations),
      }

      const response =
        mode === "edit"
          ? await apiClient.updateMonthCloseout(month, payload)
          : await apiClient.closeMonth(month, payload)

      onSaved(response)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to save month closeout")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReopen = async () => {
    if (!closeout) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiClient.reopenMonth(month)
      onSaved(response)
      setShowReopenConfirm(false)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to reopen month")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDecisionChange = (nextDecision: CloseoutDecision) => {
    setDecision(nextDecision)
    setError(null)

    if (nextDecision === "buffer" || nextDecision === null) {
      setAllocations([])
      return
    }

    if (nextDecision === "savings") {
      setAllocations([createAllocationRow(month, "savings", (availableAllocationCents / 100).toFixed(2))])
      return
    }

    setAllocations((current) => (current.length > 0 ? current : [createAllocationRow(month, "savings")]))
  }

  const addAllocation = () => {
    setAllocations((current) => [...current, createAllocationRow(month, allocationTypeOptions[0] ?? "other")])
  }

  const updateAllocation = (id: string, patch: Partial<EditableAllocationRow>) => {
    setAllocations((current) =>
      current.map((allocation) => {
        if (allocation.id !== id) {
          return allocation
        }

        const next = { ...allocation, ...patch }
        if (patch.allocation_type && patch.allocation_type !== "rollover") {
          next.target_month = ""
        }
        if (patch.allocation_type && patch.allocation_type !== "fund") {
          next.fund_id = ""
        }
        if (patch.allocation_type === "rollover" && !next.target_month) {
          next.target_month = getNextMonthKey(month)
        }
        if (patch.allocation_type && !next.label.trim()) {
          next.label = ""
        }
        return next
      })
    )
  }

  const removeAllocation = (id: string) => {
    setAllocations((current) => current.filter((allocation) => allocation.id !== id))
  }

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={presentation.title}
        description={presentation.description}
        footer={
          <MonthCloseoutTrayFooter
            mode={mode}
            isSubmitting={isSubmitting}
            hasCloseout={Boolean(closeout)}
            primaryCtaLabel={footerState.buttonText}
            footerStatus={footerState.helperText}
            isDisabled={footerState.disabled || allocatedTotalCents > availableAllocationCents}
            onSubmit={() => void submitForm()}
            onOpenChange={onOpenChange}
            onModeChange={onModeChange}
            onShowReopenConfirm={() => setShowReopenConfirm(true)}
          />
        }
        desktopClassName="sm:w-[min(calc(100dvw-2rem),64rem)] sm:max-w-[64rem]"
        bodyClassName="space-y-5"
      >
        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {presentation.isReview ? (
          <ReviewContent saved={saved} computed={computed} />
        ) : (
          <EditorContent
            monthLabel={monthLabel}
            mode={mode}
            outcome={outcome}
            saved={saved}
            computed={computed}
            notes={notes}
            decision={decision}
            resultAmountCents={resultAmountCents}
            plannedTotalCents={plannedTotalCents}
            actualTotalCents={actualTotalCents}
            availableAllocationCents={availableAllocationCents}
            allocatedTotalCents={allocatedTotalCents}
            remainingAllocationCents={remainingAllocationCents}
            showDecisionSection={showDecisionSection}
            showAllocationEditor={showAllocationEditor}
            isBreakdownExpanded={isBreakdownExpanded}
            allocations={allocations}
            allocationTypeOptions={allocationTypeOptions}
            funds={funds}
            isFundsLoading={isFundsLoading}
            onDecisionChange={handleDecisionChange}
            onAddAllocation={addAllocation}
            onUpdateAllocation={updateAllocation}
            onRemoveAllocation={removeAllocation}
            onNotesChange={setNotes}
            onToggleBreakdown={() => setIsBreakdownExpanded((current) => !current)}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveConfirmDialog
        open={showReopenConfirm}
        onOpenChange={setShowReopenConfirm}
        title="Reopen this month?"
        description="The closeout will stay on record, but the month will need to be closed again after review."
        confirmLabel="Reopen month"
        confirmVariant="destructive"
        confirmDisabled={isSubmitting}
        closeDisabled={isSubmitting}
        onConfirm={() => void handleReopen()}
      >
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          Reopen {monthLabel} if you need to revise transactions or budget decisions before closing it again.
        </div>
      </ResponsiveConfirmDialog>
    </>
  )
}

function MonthCloseoutTrayFooter({
  mode,
  isSubmitting,
  hasCloseout,
  primaryCtaLabel,
  footerStatus,
  isDisabled,
  onSubmit,
  onOpenChange,
  onModeChange,
  onShowReopenConfirm,
}: {
  mode: MonthCloseoutTrayMode
  isSubmitting: boolean
  hasCloseout: boolean
  primaryCtaLabel: string
  footerStatus: string
  isDisabled: boolean
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: MonthCloseoutTrayMode) => void
  onShowReopenConfirm: () => void
}) {
  if (mode === "review") {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" className="h-12 rounded-xl" onClick={() => onModeChange("close")}>
          Update closeout
        </Button>
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => onShowReopenConfirm()}>
          Reopen month
        </Button>
        <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={() => onOpenChange(false)}>
          Keep current closeout
        </Button>
      </div>
    )
  }

  if (mode === "view") {
    return (
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Button type="button" className="h-12 rounded-xl" onClick={() => onOpenChange(false)}>
          Done
        </Button>
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => onModeChange("edit")}>
          <Pencil className="size-4" />
          Edit closeout
        </Button>
        <Button type="button" variant="ghost" className="h-12 rounded-xl text-destructive hover:text-destructive" onClick={onShowReopenConfirm}>
          <RotateCcw className="size-4" />
          Reopen month
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="text-sm text-muted-foreground">{footerStatus}</div>
      <Button
        type="button"
        className="h-12 rounded-xl px-6"
        onClick={onSubmit}
        disabled={isSubmitting || !hasCloseout || isDisabled}
      >
        {primaryCtaLabel}
      </Button>
    </div>
  )
}

function ReviewContent({
  saved,
  computed,
}: {
  saved: MonthCloseoutSaved | null
  computed: MonthCloseoutComputed | null
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-amber-200/80 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-amber-700" />
          <div>
            <p className="font-medium text-amber-900">This month changed after it was closed.</p>
            <p className="mt-1 text-sm text-amber-800">Review the saved closeout against the current month before deciding what to keep.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ComparisonCard
          label="Stored closeout"
          resultType={saved?.result_type ?? "balanced"}
          resultAmount={getResultAmount(saved?.result_type ?? "balanced", saved)}
          detail={saved ? `Closed ${formatDateTimeValue(saved.closed_at, { month: "short", day: "numeric", year: "numeric" })}` : "No saved closeout"}
        />
        <ComparisonCard
          label="Current month result"
          resultType={computed?.result_type ?? "balanced"}
          resultAmount={getResultAmount(computed?.result_type ?? "balanced", computed)}
          detail="Based on current budget and transactions"
        />
      </div>

      {saved?.stale_reasons?.length ? (
        <div className="rounded-3xl border border-border/60 bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Why it is stale</p>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            {saved.stale_reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saved?.allocations?.length ? <CloseoutLedger allocations={saved.allocations} /> : null}
    </div>
  )
}

function EditorContent({
  monthLabel,
  mode,
  outcome,
  saved,
  computed,
  notes,
  decision,
  resultAmountCents,
  plannedTotalCents,
  actualTotalCents,
  availableAllocationCents,
  allocatedTotalCents,
  remainingAllocationCents,
  showDecisionSection,
  showAllocationEditor,
  isBreakdownExpanded,
  allocations,
  allocationTypeOptions,
  funds,
  isFundsLoading,
  onDecisionChange,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
  onNotesChange,
  onToggleBreakdown,
}: {
  monthLabel: string
  mode: MonthCloseoutTrayMode
  outcome: CloseoutOutcome
  saved: MonthCloseoutSaved | null
  computed: MonthCloseoutComputed | null
  notes: string
  decision: CloseoutDecision
  resultAmountCents: number
  plannedTotalCents: number
  actualTotalCents: number
  availableAllocationCents: number
  allocatedTotalCents: number
  remainingAllocationCents: number
  showDecisionSection: boolean
  showAllocationEditor: boolean
  isBreakdownExpanded: boolean
  allocations: EditableAllocationRow[]
  allocationTypeOptions: MonthCloseoutAllocationType[]
  funds: FundListItem[]
  isFundsLoading: boolean
  onDecisionChange: (decision: CloseoutDecision) => void
  onAddAllocation: () => void
  onUpdateAllocation: (id: string, patch: Partial<EditableAllocationRow>) => void
  onRemoveAllocation: (id: string) => void
  onNotesChange: (value: string) => void
  onToggleBreakdown: () => void
}) {
  const isReadOnly = mode === "view"

  return (
    <div className={cn("grid gap-5 min-[900px]:grid-cols-[minmax(26rem,1.05fr)_minmax(22rem,0.95fr)] min-[900px]:items-start", (showDecisionSection || isReadOnly) && "min-[900px]:overflow-hidden")}>
      <div className="space-y-5 min-[900px]:sticky min-[900px]:top-0">
        <CloseoutHero
          monthLabel={monthLabel}
          outcome={outcome}
          resultAmountCents={resultAmountCents}
          plannedTotalCents={plannedTotalCents}
          actualTotalCents={actualTotalCents}
          saved={saved}
          isClosed={isReadOnly}
        />

        {computed ? (
          <div className="hidden min-[900px]:block">
            <CloseoutReceipt monthLabel={monthLabel} computed={computed} expanded collapsible={false} />
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        {showDecisionSection ? (
          <ExtraMoneyDecision
            availableAllocationCents={availableAllocationCents}
            decision={decision}
            onDecisionChange={onDecisionChange}
          />
        ) : null}

        {showAllocationEditor ? (
          <AllocationEditor
            monthLabel={monthLabel}
            maxAllocationAmountCents={availableAllocationCents}
            remainingAllocationCents={remainingAllocationCents}
            allocationTypeOptions={allocationTypeOptions}
            allocations={allocations}
            funds={funds}
            isFundsLoading={isFundsLoading}
            onAddAllocation={onAddAllocation}
            onUpdateAllocation={onUpdateAllocation}
            onRemoveAllocation={onRemoveAllocation}
          />
        ) : null}

        {isReadOnly ? <ClosedMonthPanel monthLabel={monthLabel} outcome={outcome} saved={saved} resultAmountCents={resultAmountCents} allocatedTotalCents={allocatedTotalCents} /> : null}

        <MonthNoteCard monthLabel={monthLabel} isReadOnly={isReadOnly} notes={notes} savedNotes={saved?.notes ?? null} onNotesChange={onNotesChange} />

        {computed ? (
          <div className="min-[900px]:hidden">
            <CloseoutReceipt
              monthLabel={monthLabel}
              computed={computed}
              expanded={isBreakdownExpanded}
              collapsible
              onToggle={onToggleBreakdown}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CloseoutHero({
  monthLabel,
  outcome,
  resultAmountCents,
  plannedTotalCents,
  actualTotalCents,
  saved,
  isClosed,
}: {
  monthLabel: string
  outcome: CloseoutOutcome
  resultAmountCents: number
  plannedTotalCents: number
  actualTotalCents: number
  saved: MonthCloseoutSaved | null
  isClosed: boolean
}) {
  const allocatedCents = parseMoneyToCents(saved?.allocated_amount)

  if (isClosed) {
    const closedSummary = buildClosedSummary({
      monthLabel,
      outcome,
      varianceCents: resultAmountCents,
      allocatedCents,
      unallocatedCents: parseMoneyToCents(saved?.unallocated_amount),
      allocations: saved?.allocations ?? [],
    })

    return (
      <div className="rounded-[2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(250,248,242,0.95),rgba(255,255,255,0.95))] p-5 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Month closeout</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{closedSummary.title}</h2>
        <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{closedSummary.amountLine}</p>
        <p className="mt-2 text-sm text-muted-foreground">{closedSummary.detailLine}</p>
      </div>
    )
  }

  const title =
    outcome === "under"
      ? `${monthLabel} ended under plan`
      : outcome === "over"
        ? `${monthLabel} finished over plan`
        : `${monthLabel} landed on plan`
  const amountLine =
    outcome === "under"
      ? `You kept ${formatCents(resultAmountCents)}`
      : outcome === "over"
        ? `You were ${formatCents(resultAmountCents)} over`
        : `You spent exactly ${formatCents(plannedTotalCents)}`
  const detailLine =
    outcome === "on_plan"
      ? "You spent your monthly plan exactly."
      : `You spent ${formatCents(actualTotalCents)} of your ${formatCents(plannedTotalCents)} plan.`

  return (
    <div className="rounded-[2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(250,248,242,0.95),rgba(255,255,255,0.95))] p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">Monthly result</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      <p className={cn("mt-4 text-3xl font-semibold tracking-tight sm:text-4xl", outcome === "under" ? "text-emerald-700" : outcome === "over" ? "text-amber-700" : "text-foreground")}>
        {amountLine}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detailLine}</p>
      {saved?.is_stale ? <Badge variant="outline" className="mt-4">Needs review</Badge> : null}
    </div>
  )
}

function CloseoutReceipt({
  monthLabel,
  computed,
  expanded,
  collapsible,
  onToggle,
}: {
  monthLabel: string
  computed: MonthCloseoutComputed
  expanded: boolean
  collapsible: boolean
  onToggle?: () => void
}) {
  const rows = getReceiptRows(computed)

  return (
    <div className="rounded-[2rem] border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">How {monthLabel} landed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCurrency(computed.actual.total)} spent from a {formatCurrency(computed.planned.total)} plan
          </p>
        </div>
        {collapsible ? (
          <Button type="button" variant="ghost" size="sm" className="rounded-full px-3" onClick={onToggle} aria-expanded={expanded}>
            {expanded ? "Hide details" : "View details"}
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </Button>
        ) : null}
      </div>
      {expanded ? <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const statusLabel =
            row.differenceCents > 0
              ? `${formatCents(row.differenceCents)} left`
              : row.differenceCents < 0
                ? `${formatCents(Math.abs(row.differenceCents))} over`
                : "On plan"

          return (
            <div key={row.category} className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{row.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCents(row.actualCents)} of {formatCents(row.plannedCents)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit rounded-full border-transparent",
                    row.differenceCents < 0
                      ? "bg-amber-100 text-amber-800"
                      : row.differenceCents > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-foreground"
                  )}
                >
                  {statusLabel}
                </Badge>
              </div>
            </div>
          )
        })}
      </div> : null}
    </div>
  )
}

function ExtraMoneyDecision({
  availableAllocationCents,
  decision,
  onDecisionChange,
}: {
  availableAllocationCents: number
  decision: CloseoutDecision
  onDecisionChange: (decision: CloseoutDecision) => void
}) {
  const options: Array<{
    value: Exclude<CloseoutDecision, null>
    title: string
    helper: string
  }> = [
    {
      value: "savings",
      title: "Add to savings",
      helper: `Move the full ${formatCents(availableAllocationCents)} into savings.`,
    },
    {
      value: "buffer",
      title: "Keep as buffer",
      helper: "Leave it unassigned for now.",
    },
    {
      value: "split",
      title: "Split it up",
      helper: "Divide it across savings, debt, or another goal.",
    },
  ]

  return (
    <div className="rounded-[2rem] border border-border/60 bg-card p-5">
      <p className="text-sm font-medium text-foreground">Where should the extra go?</p>
      <p className="mt-1 text-sm text-muted-foreground">Choose how to handle the {formatCents(availableAllocationCents)} left from this month.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Where should the extra go?">
        {options.map((option) => {
          const isSelected = decision === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || decision === null ? 0 : -1}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isSelected
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : "border-border/60 bg-background hover:border-foreground/20 hover:bg-muted/30"
              )}
              onClick={() => onDecisionChange(option.value)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault()
                  onDecisionChange(option.value)
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-foreground">{option.title}</p>
                {isSelected ? (
                  <Badge className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] text-white">
                    <CheckCircle2 className="size-3.5" />
                    Selected
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{option.helper}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AllocationEditor({
  monthLabel,
  maxAllocationAmountCents,
  remainingAllocationCents,
  allocationTypeOptions,
  allocations,
  funds,
  isFundsLoading,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
}: {
  monthLabel: string
  maxAllocationAmountCents: number
  remainingAllocationCents: number
  allocationTypeOptions: MonthCloseoutAllocationType[]
  allocations: EditableAllocationRow[]
  funds: FundListItem[]
  isFundsLoading: boolean
  onAddAllocation: () => void
  onUpdateAllocation: (id: string, patch: Partial<EditableAllocationRow>) => void
  onRemoveAllocation: (id: string) => void
}) {
  return (
    <div className="space-y-4 rounded-[2rem] border border-border/60 bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Place the extra money</p>
          <p className="mt-1 text-sm text-muted-foreground">Assign up to {formatCents(maxAllocationAmountCents)}. Anything left becomes buffer.</p>
        </div>
        <Badge variant="outline">{formatCents(remainingAllocationCents)} left</Badge>
      </div>

      <div className="space-y-4">
        {allocations.map((allocation) => (
          <AllocationEditorRow
            key={allocation.id}
            monthLabel={monthLabel}
            allocation={allocation}
            allocationTypeOptions={allocationTypeOptions}
            funds={funds}
            isFundsLoading={isFundsLoading}
            onUpdate={onUpdateAllocation}
            onRemove={onRemoveAllocation}
          />
        ))}
      </div>

      <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={onAddAllocation}>
        <Plus className="size-4" />
        Add another
      </Button>
    </div>
  )
}

function AllocationEditorRow({
  monthLabel,
  allocation,
  allocationTypeOptions,
  funds,
  isFundsLoading,
  onUpdate,
  onRemove,
}: {
  monthLabel: string
  allocation: EditableAllocationRow
  allocationTypeOptions: MonthCloseoutAllocationType[]
  funds: FundListItem[]
  isFundsLoading: boolean
  onUpdate: (id: string, patch: Partial<EditableAllocationRow>) => void
  onRemove: (id: string) => void
}) {
  const hasCustomLabel = Boolean(allocation.label.trim())

  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{getAllocationCardTitle(allocation.allocation_type, allocation.label)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="rounded-full px-3" onClick={() => onRemove(allocation.id)}>
          Remove
        </Button>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`allocation-type-${allocation.id}`}>Send to</Label>
          <select
            id={`allocation-type-${allocation.id}`}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-xl border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]"
            value={allocation.allocation_type}
            onChange={(event) =>
              onUpdate(allocation.id, {
                allocation_type: event.target.value as MonthCloseoutAllocationType,
              })
            }
          >
            {allocationTypeOptions.map((option) => (
              <option key={option} value={option}>
                {getAllocationTypeLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <CompactCurrencyInput
          id={`allocation-amount-${allocation.id}`}
          label="Amount"
          value={allocation.amount}
          onValueChange={(value) => onUpdate(allocation.id, { amount: value })}
        />

        {allocation.allocation_type === "rollover" ? (
          <div className="grid gap-2">
            <Label htmlFor={`allocation-target-month-${allocation.id}`}>Target month</Label>
            <Input
              id={`allocation-target-month-${allocation.id}`}
              value={allocation.target_month}
              onChange={(event) => onUpdate(allocation.id, { target_month: event.target.value })}
              placeholder="YYYY-MM"
            />
          </div>
        ) : null}

        {allocation.allocation_type === "fund" ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`allocation-fund-${allocation.id}`}>Fund</Label>
              <Button variant="ghost" size="sm" className="h-auto px-0 text-sm" asChild>
                <Link href="/insights/funds?create=1">Create new fund</Link>
              </Button>
            </div>
            <select
              id={`allocation-fund-${allocation.id}`}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-xl border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]"
              value={allocation.fund_id}
              onChange={(event) => onUpdate(allocation.id, { fund_id: event.target.value })}
              disabled={isFundsLoading}
            >
              <option value="">
                {isFundsLoading ? "Loading funds..." : funds.length ? "Choose a fund" : "No active funds yet"}
              </option>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {hasCustomLabel ? (
          <div className="grid gap-2">
            <Label htmlFor={`allocation-label-${allocation.id}`}>Label</Label>
            <Input
              id={`allocation-label-${allocation.id}`}
              value={allocation.label}
              onChange={(event) => onUpdate(allocation.id, { label: event.target.value })}
              placeholder={getDefaultAllocationLabel(allocation.allocation_type)}
            />
          </div>
        ) : (
          <button
            type="button"
            className="w-fit text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => onUpdate(allocation.id, { label: getDefaultAllocationLabel(allocation.allocation_type) })}
          >
            Add label
          </button>
        )}

        <div className="grid gap-2">
          <Label htmlFor={`allocation-notes-${allocation.id}`}>Note</Label>
          <Textarea
            id={`allocation-notes-${allocation.id}`}
            rows={2}
            value={allocation.notes}
            onChange={(event) => onUpdate(allocation.id, { notes: event.target.value })}
            placeholder="Emergency fund, vacation, debt payoff..."
          />
        </div>
      </div>
    </div>
  )
}

function ClosedMonthPanel({
  monthLabel,
  outcome,
  saved,
  resultAmountCents,
  allocatedTotalCents,
}: {
  monthLabel: string
  outcome: CloseoutOutcome
  saved: MonthCloseoutSaved | null
  resultAmountCents: number
  allocatedTotalCents: number
}) {
  return (
    <div className="space-y-5">
      {saved?.allocations?.length ? <CloseoutLedger allocations={saved.allocations} /> : (
        <div className="rounded-[2rem] border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Closeout ledger</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {outcome === "under"
              ? "No extra money was assigned for this month."
              : outcome === "over"
                ? `${monthLabel} closed ${formatCents(resultAmountCents)} over plan.`
                : `${monthLabel} closed on plan.`}
          </p>
        </div>
      )}

      {saved ? (
        <div className="rounded-[2rem] border border-border/60 bg-card p-5">
          <p className="text-sm font-medium text-foreground">Saved totals</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">{formatCurrency(saved.allocated_amount)} assigned</Badge>
            <Badge variant="outline">{formatCurrency(saved.unallocated_amount)} left unassigned</Badge>
            {allocatedTotalCents > 0 ? <Badge variant="outline">{formatCents(allocatedTotalCents)} recorded</Badge> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MonthNoteCard({
  monthLabel,
  isReadOnly,
  notes,
  savedNotes,
  onNotesChange,
}: {
  monthLabel: string
  isReadOnly: boolean
  notes: string
  savedNotes: string | null
  onNotesChange: (value: string) => void
}) {
  return (
    <div className="space-y-2 rounded-[2rem] border border-border/60 bg-card p-5">
      <Label htmlFor="closeout-notes">Month note</Label>
      {isReadOnly ? (
        <div className="rounded-2xl bg-muted/30 px-4 py-3 text-sm text-foreground">
          {savedNotes?.trim() ? savedNotes : "No note saved for this month."}
        </div>
      ) : (
        <Textarea
          id="closeout-notes"
          rows={3}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={`Anything worth remembering about ${monthLabel}?`}
        />
      )}
    </div>
  )
}

function ComparisonCard({
  label,
  resultType,
  resultAmount,
  detail,
}: {
  label: string
  resultType: MonthCloseoutResultType
  resultAmount: number
  detail: string
}) {
  const outcome = getCloseoutOutcome(resultType)
  const summary =
    outcome === "under"
      ? `${formatCurrency(resultAmount)} under plan`
      : outcome === "over"
        ? `${formatCurrency(resultAmount)} over plan`
        : "Landed on plan"

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className={cn("mt-3 text-2xl font-semibold tracking-tight", outcome === "under" ? "text-emerald-700" : outcome === "over" ? "text-amber-700" : "text-foreground")}>
        {summary}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function CompactCurrencyInput({
  id,
  label,
  value,
  onValueChange,
}: {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
}) {
  const displayValue = formatCurrencyInputValue(value)

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        enterKeyHint="next"
        autoComplete="off"
        placeholder="$0.00"
        value={displayValue}
        onChange={(event) => onValueChange(normalizeCurrencyInputValue(event.target.value))}
      />
    </div>
  )
}

function normalizeCurrencyInputValue(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (!digits) {
    return ""
  }

  const normalized = digits.replace(/^0+/, "") || "0"
  const padded = normalized.padStart(3, "0")
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`
}

function formatCurrencyInputValue(value: string): string {
  if (!value) {
    return ""
  }

  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount)) {
    return value
  }

  return formatCurrency(amount)
}

function CloseoutLedger({ allocations }: { allocations: MonthCloseoutAllocation[] }) {
  return (
    <div className="rounded-[2rem] border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Closeout ledger</p>
      </div>
      <div className="mt-4 space-y-3">
        {allocations.map((allocation) => (
          <div key={allocation.id} className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{getAllocationCardTitle(allocation.allocation_type, allocation.label)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {allocation.fund_name?.trim() || getAllocationTypeLabel(allocation.allocation_type)}
                  {allocation.target_month ? ` • ${allocation.target_month}` : ""}
                </p>
              </div>
              <p className="font-semibold text-foreground">{formatCurrency(allocation.amount)}</p>
            </div>
            {allocation.notes ? <p className="mt-2 text-sm text-muted-foreground">{allocation.notes}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
