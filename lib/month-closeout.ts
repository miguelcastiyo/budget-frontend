import { formatCurrency } from "@/lib/formatters"
import type {
  MonthCloseoutAllocation,
  MonthCloseoutAllocationType,
  MonthCloseoutComputed,
  MonthCloseoutResultType,
} from "@/lib/api/types"

export type CloseoutOutcome = "under" | "over" | "on_plan"
export type CloseoutDecision = "savings" | "buffer" | "split" | null
export interface CloseoutFooterState {
  helperText: string
  buttonText: string
  disabled: boolean
}

export interface CloseoutReceiptRow {
  category: "needs" | "wants" | "savings"
  label: string
  plannedCents: number
  actualCents: number
  differenceCents: number
}

export function parseMoneyToCents(value: string | number | null | undefined): number {
  const amount = typeof value === "number" ? value : Number.parseFloat(value ?? "")
  if (!Number.isFinite(amount)) {
    return 0
  }

  return Math.round(amount * 100)
}

export function formatCents(cents: number): string {
  return formatCurrency(cents / 100)
}

export function getCloseoutOutcome(resultType: MonthCloseoutResultType): CloseoutOutcome {
  switch (resultType) {
    case "surplus":
      return "under"
    case "deficit":
      return "over"
    case "balanced":
    default:
      return "on_plan"
  }
}

export function getReceiptRows(computed: MonthCloseoutComputed): CloseoutReceiptRow[] {
  return [
    createReceiptRow("needs", computed.planned.needs, computed.actual.needs),
    createReceiptRow("wants", computed.planned.wants, computed.actual.wants),
    createReceiptRow("savings", computed.planned.savings, computed.actual.savings),
  ]
}

function createReceiptRow(
  category: CloseoutReceiptRow["category"],
  planned: string,
  actual: string
): CloseoutReceiptRow {
  const label = category.charAt(0).toUpperCase() + category.slice(1)
  const plannedCents = parseMoneyToCents(planned)
  const actualCents = parseMoneyToCents(actual)

  return {
    category,
    label,
    plannedCents,
    actualCents,
    differenceCents: plannedCents - actualCents,
  }
}

export function getDefaultAllocationLabel(type: MonthCloseoutAllocationType): string {
  switch (type) {
    case "savings":
      return "Savings"
    case "buffer":
      return "Buffer"
    case "debt":
      return "Debt payment"
    case "investment":
      return "Investment"
    case "rollover":
      return "Rollover"
    case "covered_by_buffer":
      return "Covered by buffer"
    case "ignored":
      return "Ignored"
    case "other":
    default:
      return "Allocation"
  }
}

export function getAllocationTypeLabel(type: MonthCloseoutAllocationType): string {
  switch (type) {
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
    default:
      return "Other"
  }
}

export function getAllocationCardTitle(type: MonthCloseoutAllocationType, label?: string | null): string {
  if (label?.trim()) {
    return label.trim()
  }

  switch (type) {
    case "savings":
      return "Savings deposit"
    case "buffer":
      return "Month buffer"
    case "debt":
      return "Debt payment"
    case "investment":
      return "Investment deposit"
    case "rollover":
      return "Next month rollover"
    case "covered_by_buffer":
      return "Buffer coverage"
    case "ignored":
      return "Ignored amount"
    case "other":
    default:
      return "Allocation"
  }
}

export function inferCloseoutDecision(
  allocations: Pick<MonthCloseoutAllocation, "allocation_type" | "amount">[] | null | undefined,
  availableCents: number,
  unallocatedCents = 0
): CloseoutDecision {
  if (availableCents > 0 && unallocatedCents === availableCents && (!allocations || allocations.length === 0)) {
    return "buffer"
  }

  if (!allocations?.length) {
    return null
  }

  if (allocations.length === 1 && allocations[0].allocation_type === "savings") {
    const amountCents = parseMoneyToCents(allocations[0].amount)
    if (availableCents > 0 && amountCents === availableCents) {
      return "savings"
    }
  }

  return "split"
}

export function buildFooterStatus({
  outcome,
  availableCents,
  allocatedCents,
}: {
  outcome: CloseoutOutcome
  availableCents: number
  allocatedCents: number
}): string {
  if (outcome !== "under" || availableCents <= 0) {
    return "Ready to close"
  }

  const remainingCents = Math.max(availableCents - allocatedCents, 0)
  if (allocatedCents <= 0) {
    return `${formatCents(availableCents)} ready to place`
  }
  if (remainingCents > 0) {
    return `${formatCents(remainingCents)} left to place`
  }

  return `${formatCents(availableCents)} assigned`
}

export function buildFooterState({
  monthLabel,
  outcome,
  decision,
  availableCents,
  allocatedCents,
  isSubmitting,
  hasError,
}: {
  monthLabel: string
  outcome: CloseoutOutcome
  decision: CloseoutDecision
  availableCents: number
  allocatedCents: number
  isSubmitting: boolean
  hasError: boolean
}): CloseoutFooterState {
  if (isSubmitting) {
    return {
      helperText: "Saving closeout...",
      buttonText: "Closing...",
      disabled: true,
    }
  }

  if (hasError) {
    return {
      helperText: `Could not close ${monthLabel}`,
      buttonText: "Try again",
      disabled: false,
    }
  }

  if (outcome === "on_plan") {
    return {
      helperText: `${monthLabel} landed on plan`,
      buttonText: `Close ${monthLabel}`,
      disabled: false,
    }
  }

  if (outcome === "over") {
    return {
      helperText: `${formatCents(availableCents)} over plan`,
      buttonText: `Close ${monthLabel}`,
      disabled: false,
    }
  }

  const remainingCents = Math.max(availableCents - allocatedCents, 0)
  if (allocatedCents > availableCents) {
    return {
      helperText: `${formatCents(allocatedCents - availableCents)} over assigned`,
      buttonText: "Fix allocation",
      disabled: true,
    }
  }

  if (decision === null) {
    return {
      helperText: `Choose where the ${formatCents(availableCents)} should go`,
      buttonText: "Choose an option",
      disabled: true,
    }
  }

  if (decision === "buffer") {
    return {
      helperText: `${formatCents(availableCents)} kept as buffer`,
      buttonText: "Close with buffer",
      disabled: false,
    }
  }

  if (decision === "savings") {
    return {
      helperText: `${formatCents(availableCents)} assigned to savings`,
      buttonText: `Close ${monthLabel}`,
      disabled: false,
    }
  }

  if (allocatedCents <= 0) {
    return {
      helperText: "Add an amount or choose buffer",
      buttonText: `Close ${monthLabel}`,
      disabled: true,
    }
  }

  if (remainingCents > 0) {
    return {
      helperText: `${formatCents(allocatedCents)} assigned · ${formatCents(remainingCents)} buffer`,
      buttonText: `Close ${monthLabel}`,
      disabled: false,
    }
  }

  return {
    helperText: `${formatCents(availableCents)} assigned`,
    buttonText: `Close ${monthLabel}`,
    disabled: false,
  }
}

export function buildClosedSummary({
  monthLabel,
  outcome,
  varianceCents,
  allocatedCents,
  unallocatedCents,
  allocations,
}: {
  monthLabel: string
  outcome: CloseoutOutcome
  varianceCents: number
  allocatedCents: number
  unallocatedCents: number
  allocations: Pick<MonthCloseoutAllocation, "allocation_type">[]
}): {
  title: string
  amountLine: string
  detailLine: string
} {
  const title = `${monthLabel} is closed`

  if (outcome === "under") {
    if (allocatedCents > 0) {
      if (allocations.length === 1) {
        return {
          title,
          amountLine: `${formatCents(allocatedCents)} moved to ${getAllocationTypeLabel(allocations[0].allocation_type).toLowerCase()}`,
          detailLine: "You finished the month under plan.",
        }
      }

      return {
        title,
        amountLine: `${formatCents(allocatedCents)} assigned`,
        detailLine: "You finished the month under plan.",
      }
    }

    return {
      title,
      amountLine: unallocatedCents > 0 ? `${formatCents(unallocatedCents)} kept as buffer` : "No extra money was assigned",
      detailLine: "You finished the month under plan.",
    }
  }

  if (outcome === "over") {
    return {
      title,
      amountLine: `${formatCents(varianceCents)} over plan recorded`,
      detailLine: "This month finished over plan.",
    }
  }

  return {
    title,
    amountLine: "Month landed on plan",
    detailLine: "Everything closed exactly on budget.",
  }
}
