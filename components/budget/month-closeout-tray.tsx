"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, Pencil, Plus, RotateCcw, Wallet } from "lucide-react"
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
import type {
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
  label: string
  amount: string
  target_month: string
  notes: string
}

interface TrayPresentation {
  title: string
  isReview: boolean
  isReadOnly: boolean
  resultLabel: string
}

const SURPLUS_TYPES: MonthCloseoutAllocationType[] = [
  "savings",
  "buffer",
  "rollover",
  "debt",
  "investment",
  "other",
]

const DEFICIT_TYPES: MonthCloseoutAllocationType[] = [
  "covered_by_buffer",
  "savings",
  "rollover",
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

function getResultLabel(resultType: MonthCloseoutResultType, amount: number): string {
  if (resultType === "balanced") {
    return "Balanced exactly"
  }

  const suffix = resultType === "surplus" ? "under plan" : "over plan"
  return `${formatCurrency(amount)} ${suffix}`
}

function getAllocationTypeLabel(value: MonthCloseoutAllocationType): string {
  switch (value) {
    case "savings":
      return "Savings"
    case "investment":
      return "Investment"
    case "debt":
      return "Debt"
    case "rollover":
      return "Rollover"
    case "buffer":
      return "Buffer"
    case "covered_by_buffer":
      return "Covered by buffer"
    case "ignored":
      return "Ignored"
    case "other":
      return "Other"
    default:
      return value
  }
}

function allocationToRow(allocation: MonthCloseoutAllocation): EditableAllocationRow {
  return {
    id: allocation.id,
    allocation_type: allocation.allocation_type,
    label: allocation.label ?? "",
    amount: allocation.amount,
    target_month: allocation.target_month ?? "",
    notes: allocation.notes ?? "",
  }
}

function createAllocationRow(month: string, type: MonthCloseoutAllocationType): EditableAllocationRow {
  return {
    id: `draft-${Math.random().toString(36).slice(2, 10)}`,
    allocation_type: type,
    label: "",
    amount: "",
    target_month: type === "rollover" ? getNextMonthKey(month) : "",
    notes: "",
  }
}

function comparisonTone(resultType: MonthCloseoutResultType): string {
  switch (resultType) {
    case "surplus":
      return "text-emerald-700"
    case "deficit":
      return "text-amber-700"
    case "balanced":
      return "text-foreground"
    default:
      return "text-foreground"
  }
}

function buildPayloadAllocations(rows: EditableAllocationRow[]): MonthCloseoutAllocationInput[] {
  return rows
    .filter((row) => parseAmount(row.amount) > 0)
    .map((row) => ({
      allocation_type: row.allocation_type,
      amount: row.amount,
      label: row.label.trim() || null,
      target_month: row.allocation_type === "rollover" ? row.target_month || null : null,
      notes: row.notes.trim() || null,
    }))
}

function getTrayPresentation(mode: MonthCloseoutTrayMode): TrayPresentation {
  switch (mode) {
    case "review":
      return {
        title: "Closeout review",
        isReview: true,
        isReadOnly: false,
        resultLabel: "Saved result",
      }
    case "view":
      return {
        title: "Month closeout",
        isReview: false,
        isReadOnly: true,
        resultLabel: "Saved result",
      }
    case "edit":
      return {
        title: "Edit closeout",
        isReview: false,
        isReadOnly: false,
        resultLabel: "Saved result",
      }
    case "close":
    default:
      return {
        title: "Close month",
        isReview: false,
        isReadOnly: false,
        resultLabel: "Current result",
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
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)
  const [isPlannedActualExpanded, setIsPlannedActualExpanded] = useState(true)

  const computed = closeout?.computed ?? null
  const saved = closeout?.closeout ?? null
  const activeResultType = (mode === "close" ? computed?.result_type : saved?.result_type) ?? computed?.result_type ?? "balanced"
  const activeSource = mode === "close" ? computed : saved
  const maxAllocationAmount = getResultAmount(activeResultType, activeSource)
  const allocatedTotal = useMemo(
    () => allocations.reduce((sum, allocation) => sum + parseAmount(allocation.amount), 0),
    [allocations]
  )
  const remainingAllocation = Math.max(maxAllocationAmount - allocatedTotal, 0)
  const allocationTypeOptions = activeResultType === "deficit" ? DEFICIT_TYPES : SURPLUS_TYPES
  const presentation = getTrayPresentation(mode)

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    setNotes(saved?.notes ?? "")
    setAllocations(saved?.allocations?.map(allocationToRow) ?? [])
  }, [open, saved])

  useEffect(() => {
    if (!open) {
      return
    }

    if (typeof window === "undefined") {
      setIsPlannedActualExpanded(true)
      return
    }

    setIsPlannedActualExpanded(window.matchMedia("(min-width: 640px)").matches)
  }, [open])

  const monthLabel = formatMonthLabel(month) ?? month
  const isBalanced = activeResultType === "balanced"
  const canEditAllocations = !isBalanced
  const primaryCtaLabel =
    mode === "edit"
      ? "Save Closeout"
      : mode === "close" && (closeout?.status === "reopened" || saved?.is_stale)
        ? "Update Closeout"
        : `Close ${formatMonthValue(month, { month: "long" }) ?? month}`

  const validateForm = (): boolean => {
    if (!canEditAllocations) {
      return true
    }

    if (allocatedTotal > maxAllocationAmount + 0.001) {
      setError("Allocations cannot exceed this month’s closeout amount.")
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
        setError("Each allocation row needs an amount greater than zero.")
        return false
      }

      if (row.allocation_type === "rollover" && !row.target_month.trim()) {
        setError("Rollover allocations need a target month.")
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
        allocations: canEditAllocations ? buildPayloadAllocations(allocations) : [],
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

  const applyQuickAllocation = (type: MonthCloseoutAllocationType) => {
    setAllocations([
      {
        ...createAllocationRow(month, type),
        amount: maxAllocationAmount.toFixed(2),
      },
    ])
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
        if (patch.allocation_type === "rollover" && !next.target_month) {
          next.target_month = getNextMonthKey(month)
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
        description={monthLabel}
        footer={
          <MonthCloseoutTrayFooter
            mode={mode}
            canEditAllocations={canEditAllocations}
            allocatedTotal={allocatedTotal}
            maxAllocationAmount={maxAllocationAmount}
            remainingAllocation={remainingAllocation}
            isSubmitting={isSubmitting}
            hasCloseout={Boolean(closeout)}
            primaryCtaLabel={primaryCtaLabel}
            onSubmit={() => void submitForm()}
            onOpenChange={onOpenChange}
            onModeChange={onModeChange}
            onShowReopenConfirm={() => setShowReopenConfirm(true)}
          />
        }
        desktopClassName="sm:w-[min(calc(100dvw-2rem),44rem)] sm:max-w-[44rem]"
        bodyClassName="space-y-5"
      >
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {presentation.isReview ? (
          <ReviewContent saved={saved} computed={computed} />
        ) : (
          <EditorContent
            mode={mode}
            presentation={presentation}
            saved={saved}
            computed={computed}
            notes={notes}
            activeResultType={activeResultType}
            maxAllocationAmount={maxAllocationAmount}
            remainingAllocation={remainingAllocation}
            canEditAllocations={canEditAllocations}
            allocationTypeOptions={allocationTypeOptions}
            allocations={allocations}
            isPlannedActualExpanded={isPlannedActualExpanded}
            onTogglePlannedActual={() => setIsPlannedActualExpanded((current) => !current)}
            onQuickAllocation={applyQuickAllocation}
            onAddAllocation={addAllocation}
            onUpdateAllocation={updateAllocation}
            onRemoveAllocation={removeAllocation}
            onNotesChange={setNotes}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveConfirmDialog
        open={showReopenConfirm}
        onOpenChange={setShowReopenConfirm}
        title="Reopen this month?"
        description="The closeout will stay on record, but the month will need to be closed again after review."
        confirmLabel="Reopen Month"
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
  canEditAllocations,
  allocatedTotal,
  maxAllocationAmount,
  remainingAllocation,
  isSubmitting,
  hasCloseout,
  primaryCtaLabel,
  onSubmit,
  onOpenChange,
  onModeChange,
  onShowReopenConfirm,
}: {
  mode: MonthCloseoutTrayMode
  canEditAllocations: boolean
  allocatedTotal: number
  maxAllocationAmount: number
  remainingAllocation: number
  isSubmitting: boolean
  hasCloseout: boolean
  primaryCtaLabel: string
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: MonthCloseoutTrayMode) => void
  onShowReopenConfirm: () => void
}) {
  if (mode === "review") {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => onModeChange("close")}>
          Update Closeout
        </Button>
        <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={() => onOpenChange(false)}>
          Keep Current Closeout
        </Button>
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={onShowReopenConfirm}>
          Reopen Month
        </Button>
      </div>
    )
  }

  if (mode === "view") {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => onModeChange("edit")}>
          <Pencil className="size-4" />
          Edit Allocations
        </Button>
        <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={() => onOpenChange(false)}>
          Done
        </Button>
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={onShowReopenConfirm}>
          <RotateCcw className="size-4" />
          Reopen Month
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="text-sm text-muted-foreground">
        {canEditAllocations
          ? allocatedTotal > maxAllocationAmount + 0.001
            ? `${formatCurrency(allocatedTotal - maxAllocationAmount)} over allocated`
            : `${formatCurrency(remainingAllocation)} left unassigned`
          : "No allocations needed for a balanced closeout."}
      </div>
      <Button
        type="button"
        className="h-12 rounded-xl px-6"
        onClick={onSubmit}
        disabled={isSubmitting || !hasCloseout || allocatedTotal > maxAllocationAmount + 0.001}
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
            <p className="mt-1 text-sm text-amber-800">Review the stored snapshot against the current month before deciding what to keep.</p>
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

      {!!saved?.stale_reasons?.length && (
        <div className="rounded-3xl border border-border/60 bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Why it is stale</p>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            {saved.stale_reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {saved?.allocations?.length ? <AllocationSummaryList allocations={saved.allocations} /> : null}
    </div>
  )
}

function EditorContent({
  mode,
  presentation,
  saved,
  computed,
  notes,
  activeResultType,
  maxAllocationAmount,
  remainingAllocation,
  canEditAllocations,
  allocationTypeOptions,
  allocations,
  isPlannedActualExpanded,
  onTogglePlannedActual,
  onQuickAllocation,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
  onNotesChange,
}: {
  mode: MonthCloseoutTrayMode
  presentation: TrayPresentation
  saved: MonthCloseoutSaved | null
  computed: MonthCloseoutComputed | null
  notes: string
  activeResultType: MonthCloseoutResultType
  maxAllocationAmount: number
  remainingAllocation: number
  canEditAllocations: boolean
  allocationTypeOptions: MonthCloseoutAllocationType[]
  allocations: EditableAllocationRow[]
  isPlannedActualExpanded: boolean
  onTogglePlannedActual: () => void
  onQuickAllocation: (type: MonthCloseoutAllocationType) => void
  onAddAllocation: () => void
  onUpdateAllocation: (id: string, patch: Partial<EditableAllocationRow>) => void
  onRemoveAllocation: (id: string) => void
  onNotesChange: (value: string) => void
}) {
  return (
    <div className="space-y-5">
      <ResultSummaryCard
        label={presentation.resultLabel}
        resultType={activeResultType}
        resultAmount={maxAllocationAmount}
        showSavedBadges={mode === "view" || mode === "edit"}
        saved={saved}
        hasData={Boolean(saved || computed)}
      />

      {computed && mode === "close" ? (
        <PlannedActualCard
          computed={computed}
          expanded={isPlannedActualExpanded}
          onToggle={onTogglePlannedActual}
        />
      ) : null}

      {canEditAllocations && !presentation.isReadOnly ? (
        <AllocationEditor
          activeResultType={activeResultType}
          maxAllocationAmount={maxAllocationAmount}
          remainingAllocation={remainingAllocation}
          allocationTypeOptions={allocationTypeOptions}
          allocations={allocations}
          onQuickAllocation={onQuickAllocation}
          onAddAllocation={onAddAllocation}
          onUpdateAllocation={onUpdateAllocation}
          onRemoveAllocation={onRemoveAllocation}
        />
      ) : null}

      {presentation.isReadOnly && saved?.allocations?.length ? (
        <AllocationSummaryList allocations={saved.allocations} />
      ) : null}

      <CloseoutNotesCard
        isReadOnly={presentation.isReadOnly}
        notes={notes}
        savedNotes={saved?.notes ?? null}
        onNotesChange={onNotesChange}
      />
    </div>
  )
}

function ResultSummaryCard({
  label,
  resultType,
  resultAmount,
  showSavedBadges,
  saved,
  hasData,
}: {
  label: string
  resultType: MonthCloseoutResultType
  resultAmount: number
  showSavedBadges: boolean
  saved: MonthCloseoutSaved | null
  hasData: boolean
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${comparisonTone(resultType)}`}>
        {getResultLabel(resultType, resultAmount)}
      </div>
      {hasData ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {resultType === "surplus"
            ? "You finished the month under plan."
            : resultType === "deficit"
              ? "Review how the overage should be covered."
              : "No allocations are required for this month."}
        </p>
      ) : null}
      {saved && showSavedBadges ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">{formatCurrency(saved.allocated_amount)} allocated</Badge>
          <Badge variant="outline">{formatCurrency(saved.unallocated_amount)} unassigned</Badge>
          {saved.is_stale ? <Badge variant="outline">Needs review</Badge> : null}
        </div>
      ) : null}
    </div>
  )
}

function AllocationEditor({
  activeResultType,
  maxAllocationAmount,
  remainingAllocation,
  allocationTypeOptions,
  allocations,
  onQuickAllocation,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
}: {
  activeResultType: MonthCloseoutResultType
  maxAllocationAmount: number
  remainingAllocation: number
  allocationTypeOptions: MonthCloseoutAllocationType[]
  allocations: EditableAllocationRow[]
  onQuickAllocation: (type: MonthCloseoutAllocationType) => void
  onAddAllocation: () => void
  onUpdateAllocation: (id: string, patch: Partial<EditableAllocationRow>) => void
  onRemoveAllocation: (id: string) => void
}) {
  return (
    <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Allocations</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Allocate up to {formatCurrency(maxAllocationAmount)}. Partial allocation is allowed.
          </p>
        </div>
        <Badge variant="outline">{formatCurrency(remainingAllocation)} left</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeResultType === "surplus" ? (
          <>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onQuickAllocation("savings")}>
              Send all to savings
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onQuickAllocation("buffer")}>
              Keep as buffer
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onQuickAllocation("covered_by_buffer")}>
              Covered by buffer
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onQuickAllocation("savings")}>
              Covered by savings
            </Button>
          </>
        )}
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onAddAllocation}>
          Split it up
        </Button>
      </div>

      <div className="space-y-4">
        {allocations.map((allocation, index) => (
          <AllocationEditorRow
            key={allocation.id}
            allocation={allocation}
            index={index}
            allocationTypeOptions={allocationTypeOptions}
            onUpdate={onUpdateAllocation}
            onRemove={onRemoveAllocation}
          />
        ))}

        {allocations.length === 0 ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            onClick={onAddAllocation}
          >
            <Plus className="size-4" />
            Add allocation
          </button>
        ) : null}
      </div>
    </div>
  )
}

function AllocationEditorRow({
  allocation,
  index,
  allocationTypeOptions,
  onUpdate,
  onRemove,
}: {
  allocation: EditableAllocationRow
  index: number
  allocationTypeOptions: MonthCloseoutAllocationType[]
  onUpdate: (id: string, patch: Partial<EditableAllocationRow>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Allocation {index + 1}</p>
        <Button type="button" variant="ghost" size="sm" className="rounded-full px-3" onClick={() => onRemove(allocation.id)}>
          Remove
        </Button>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`allocation-type-${allocation.id}`}>Type</Label>
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

        <div className="grid gap-2">
          <Label htmlFor={`allocation-label-${allocation.id}`}>Label</Label>
          <Input
            id={`allocation-label-${allocation.id}`}
            value={allocation.label}
            onChange={(event) => onUpdate(allocation.id, { label: event.target.value })}
            placeholder="Optional note label"
          />
        </div>

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

        <div className="grid gap-2">
          <Label htmlFor={`allocation-notes-${allocation.id}`}>Notes</Label>
          <Textarea
            id={`allocation-notes-${allocation.id}`}
            value={allocation.notes}
            onChange={(event) => onUpdate(allocation.id, { notes: event.target.value })}
            placeholder="Optional details"
          />
        </div>
      </div>
    </div>
  )
}

function CloseoutNotesCard({
  isReadOnly,
  notes,
  savedNotes,
  onNotesChange,
}: {
  isReadOnly: boolean
  notes: string
  savedNotes: string | null
  onNotesChange: (value: string) => void
}) {
  return (
    <div className="space-y-2 rounded-3xl border border-border/60 bg-card p-5">
      <Label htmlFor="closeout-notes">Notes</Label>
      {isReadOnly ? (
        <div className="rounded-2xl bg-muted/30 px-4 py-3 text-sm text-foreground">
          {savedNotes?.trim() ? savedNotes : "No notes saved for this month."}
        </div>
      ) : (
        <Textarea
          id="closeout-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Add any context you want to keep with this month."
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
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${comparisonTone(resultType)}`}>
        {getResultLabel(resultType, resultAmount)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function PlannedActualCard({
  computed,
  expanded,
  onToggle,
}: {
  computed: MonthCloseoutComputed
  expanded: boolean
  onToggle: () => void
}) {
  const rows = [
    { label: "Needs", planned: computed.planned.needs, actual: computed.actual.needs },
    { label: "Wants", planned: computed.planned.wants, actual: computed.actual.wants },
    { label: "Savings", planned: computed.planned.savings, actual: computed.actual.savings },
    { label: "Total", planned: computed.planned.total, actual: computed.actual.total },
  ]

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Planned vs actual</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Total planned {formatCurrency(computed.planned.total)} · actual {formatCurrency(computed.actual.total)}
          </p>
        </div>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded ? (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm">
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="text-muted-foreground">Planned {formatCurrency(row.planned)}</span>
              <span className="text-foreground">Actual {formatCurrency(row.actual)}</span>
            </div>
          ))}
        </div>
      ) : null}
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

function AllocationSummaryList({ allocations }: { allocations: MonthCloseoutAllocation[] }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Allocations</p>
      </div>
      <div className="mt-4 space-y-3">
        {allocations.map((allocation) => (
          <div key={allocation.id} className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{allocation.label?.trim() || getAllocationTypeLabel(allocation.allocation_type)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getAllocationTypeLabel(allocation.allocation_type)}
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
