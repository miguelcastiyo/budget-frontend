"use client"

import { Button } from "@/components/ui/button"
import { formatMonthValue } from "@/lib/date-filters"
import { formatCurrency } from "@/lib/formatters"
import type { MonthCloseoutResponse, MonthOverviewResponse } from "@/lib/api/types"

interface MonthCloseoutBackFaceProps {
  overview: MonthOverviewResponse | null
  closeout: MonthCloseoutResponse | null
  isLoading: boolean
  onCloseMonth: () => void
  onViewCloseout: () => void
  onReviewCloseout: () => void
  onSetBudget: () => void
}

export function getMonthCardFlipHint({
  month,
  overview,
  closeout,
}: {
  month?: string
  overview?: MonthOverviewResponse | null
  closeout: MonthCloseoutResponse | null
}): {
  label: string
  tone: "neutral" | "warning"
} | null {
  const monthLabel = month ? formatMonthValue(month, { month: "long" }) ?? month : null
  const leftThisMonth = parseAmount(overview?.summary.left_this_month)

  if (!closeout) {
    return { label: `${formatCurrency(Math.abs(leftThisMonth))} left this month`, tone: "neutral" }
  }

  if (closeout.closeout?.is_stale) {
    return { label: "Review closeout", tone: "warning" }
  }

  switch (closeout.status) {
    case "ready_to_close":
      return { label: monthLabel ? `Ready to close ${monthLabel}` : "Ready to close", tone: "neutral" }
    case "reopened":
      return { label: monthLabel ? `${monthLabel} reopened - ready to close` : "Reopened - ready to close", tone: "neutral" }
    case "closed":
      return { label: monthLabel ? `${monthLabel} closed` : "Month closed", tone: "neutral" }
    case "missing_budget":
      return { label: "Add a budget to review this month", tone: "warning" }
    case "future":
      return { label: "Future month preview", tone: "neutral" }
    case "open":
    default:
      return { label: `${formatCurrency(Math.abs(leftThisMonth))} left this month`, tone: "neutral" }
  }
}

export function getMonthCardAriaLabel({
  month,
  closeout,
  isFlipped,
}: {
  month?: string
  closeout: MonthCloseoutResponse | null
  isFlipped: boolean
}): string {
  const monthLabel = month ? formatMonthValue(month, { month: "long", year: "numeric" }) ?? month : "this month"

  if (!isFlipped) {
    if (closeout?.closeout?.is_stale) {
      return `Review ${monthLabel} closeout`
    }
    if (closeout?.status === "ready_to_close" || closeout?.status === "reopened") {
      return `Show ${monthLabel} closeout options`
    }
    return "Show amount left this month"
  }

  return "Show monthly spending summary"
}

function parseAmount(value: string | null | undefined): number {
  const amount = Number.parseFloat(value ?? "")
  return Number.isFinite(amount) ? amount : 0
}

function renderActionLabel(closeout: MonthCloseoutResponse | null, month: string): string {
  if (!closeout) {
    return ""
  }

  const monthLabel = formatMonthValue(month, { month: "long" }) ?? month

  if (closeout.closeout?.is_stale) {
    return "Review Closeout"
  }

  switch (closeout.status) {
    case "ready_to_close":
      return `Close ${monthLabel}`
    case "closed":
      return "View Closeout"
    case "reopened":
      return `Close ${monthLabel}`
    case "missing_budget":
      return "Set Budget"
    default:
      return ""
  }
}

export function MonthCloseoutBackFace({
  overview,
  closeout,
  isLoading,
  onCloseMonth,
  onViewCloseout,
  onReviewCloseout,
  onSetBudget,
}: MonthCloseoutBackFaceProps) {
  const summary = overview?.summary
  const progress = overview?.month_progress
  const month = closeout?.month ?? overview?.month ?? ""

  if (!closeout || isLoading) {
    const leftThisMonth = parseAmount(summary?.left_this_month)
    const isOverBudget = leftThisMonth < 0

    return (
      <BackFaceLayout
        label={isOverBudget ? "Over Budget" : "Left This Month"}
        amount={formatCurrency(Math.abs(leftThisMonth))}
        amountTone={isOverBudget ? "text-destructive" : "text-foreground"}
        detail={isOverBudget ? "above your monthly budget" : `from ${formatCurrency(summary?.total_budget ?? 0)}`}
      />
    )
  }

  if (closeout.closeout?.is_stale && closeout.closeout) {
    const originalAmount = closeout.closeout.result_type === "surplus"
      ? parseAmount(closeout.closeout.surplus_amount)
      : parseAmount(closeout.closeout.deficit_amount)
    const currentAmount = closeout.computed
      ? closeout.computed.result_type === "surplus"
        ? parseAmount(closeout.computed.surplus_amount)
        : parseAmount(closeout.computed.deficit_amount)
      : 0

    return (
      <BackFaceLayout
        label="Needs Review"
        amount="This month changed after it was closed."
        amountClassName="mt-4 text-2xl font-semibold leading-tight tracking-tight text-amber-800 sm:text-3xl"
        detail={`Original: ${describeResult(closeout.closeout.result_type, originalAmount)}`}
        secondaryDetail={`Current: ${describeResult(closeout.computed?.result_type ?? "balanced", currentAmount)}`}
        actionLabel="Review Closeout"
        onAction={onReviewCloseout}
      />
    )
  }

  switch (closeout.status) {
    case "future":
      return (
        <BackFaceLayout
          label="Future Month"
          amount="This month has not started yet."
          amountClassName="mt-4 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl"
          detail="Your plan will appear here once the month begins."
        />
      )
    case "missing_budget":
      return (
        <BackFaceLayout
          label="Budget Needed"
          amount="Add a budget for this month before closing it."
          amountClassName="mt-4 text-2xl font-semibold leading-tight tracking-tight text-amber-800 sm:text-3xl"
          actionLabel={renderActionLabel(closeout, month)}
          onAction={onSetBudget}
        />
      )
    case "ready_to_close": {
      const computed = closeout.computed
      const amount = computed?.result_type === "surplus"
        ? parseAmount(computed.surplus_amount)
        : parseAmount(computed?.deficit_amount)

      return (
        <BackFaceLayout
          label="Ready To Close"
          amount={describeResult(computed?.result_type ?? "balanced", amount)}
          amountClassName={`mt-4 text-4xl font-bold leading-none tracking-tight sm:text-5xl ${
            computed?.result_type === "deficit" ? "text-amber-700" : "text-foreground"
          }`}
          detail={describeReadyDetail(computed?.result_type ?? "balanced", computed)}
          actionLabel={renderActionLabel(closeout, month)}
          onAction={onCloseMonth}
        />
      )
    }
    case "closed": {
      const saved = closeout.closeout
      const amount = saved?.result_type === "surplus"
        ? parseAmount(saved.surplus_amount)
        : parseAmount(saved?.deficit_amount)
      const detail = saved?.result_type === "deficit"
        ? `${formatCurrency(saved.allocated_amount)} accounted for`
        : `${formatCurrency(saved?.allocated_amount ?? 0)} allocated · ${formatCurrency(saved?.unallocated_amount ?? 0)} unassigned`

      return (
        <BackFaceLayout
          label="Month Closed"
          amount={describeResult(saved?.result_type ?? "balanced", amount)}
          amountClassName={`mt-4 text-4xl font-bold leading-none tracking-tight sm:text-5xl ${
            saved?.result_type === "deficit" ? "text-amber-700" : "text-foreground"
          }`}
          detail={detail}
          actionLabel={renderActionLabel(closeout, month)}
          onAction={onViewCloseout}
        />
      )
    }
    case "reopened": {
      const computed = closeout.computed
      const amount = computed?.result_type === "surplus"
        ? parseAmount(computed.surplus_amount)
        : parseAmount(computed?.deficit_amount)

      return (
        <BackFaceLayout
          label="Reopened"
          amount={describeResult(computed?.result_type ?? "balanced", amount)}
          amountClassName={`mt-4 text-4xl font-bold leading-none tracking-tight sm:text-5xl ${
            computed?.result_type === "deficit" ? "text-amber-700" : "text-foreground"
          }`}
          detail="This month is open for review again."
          actionLabel={renderActionLabel(closeout, month)}
          onAction={onCloseMonth}
        />
      )
    }
    case "open":
    default: {
      const leftThisMonth = parseAmount(summary?.left_this_month)
      const isOverBudget = leftThisMonth < 0
      const dayAmount = progress?.daily_available_remaining ? formatCurrency(progress.daily_available_remaining) : null
      const dayCount = progress?.days_remaining ?? 0

      return (
        <BackFaceLayout
          label={isOverBudget ? "Over Budget" : "Left This Month"}
          amount={formatCurrency(Math.abs(leftThisMonth))}
          amountTone={isOverBudget ? "text-destructive" : "text-foreground"}
          detail={
            dayAmount && !isOverBudget
              ? `${dayAmount}/day available · ${dayCount} days remaining`
              : "Month still in progress"
          }
        />
      )
    }
  }
}

function BackFaceLayout({
  label,
  amount,
  detail,
  secondaryDetail,
  actionLabel,
  onAction,
  amountTone = "text-foreground",
  amountClassName,
}: {
  label: string
  amount: string
  detail?: string | null
  secondaryDetail?: string | null
  actionLabel?: string
  onAction?: () => void
  amountTone?: string
  amountClassName?: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center py-3 text-center sm:py-6">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={
          amountClassName ??
          `mt-4 text-[2.65rem] font-bold leading-none tracking-tight tabular-nums sm:mt-5 sm:text-[3.65rem] ${amountTone}`
        }
      >
        {amount}
      </span>
      {detail ? <span className="mt-4 text-sm text-muted-foreground sm:text-base">{detail}</span> : null}
      {secondaryDetail ? <span className="mt-1 text-sm text-muted-foreground sm:text-base">{secondaryDetail}</span> : null}
      {actionLabel && onAction ? (
        <Button
          type="button"
          className="mt-5 rounded-full px-5"
          onClick={(event) => {
            event.stopPropagation()
            onAction()
          }}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

function describeResult(resultType: "surplus" | "deficit" | "balanced", amount: number): string {
  if (resultType === "balanced") {
    return "Balanced exactly"
  }

  return `${formatCurrency(amount)} ${resultType === "surplus" ? "under plan" : "over plan"}`
}

function describeReadyDetail(
  resultType: "surplus" | "deficit" | "balanced",
  computed: MonthCloseoutResponse["computed"]
): string {
  if (!computed) {
    return ""
  }

  if (resultType === "balanced") {
    return "This month balanced exactly."
  }

  if (resultType === "surplus") {
    return `You spent ${formatCurrency(computed.spending_surplus_amount)} less than planned across Needs and Wants.`
  }

  return "Review what covered the overage."
}
