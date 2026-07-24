"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpNarrowWide, Plus, Repeat } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { FormChipRail } from "@/components/budget/form-chip-rail"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import { sortCards } from "@/lib/cards"
import { getCurrentMonthKey, getNextMonthKey } from "@/lib/date-filters"
import type {
  RecurringBillingType,
  RecurringExpense,
  RecurringExpenseSeriesResponse,
  Tag,
  Card as CardType,
} from "@/lib/api/types"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import {
  MonthPicker,
  RecurringDetailDialog,
  RecurringForm,
  RecurringItemRow,
} from "./_components/recurring-sections"
import { useRecurringData } from "./_hooks/use-recurring-data"
import {
  emptyForm,
  formFromItem,
  formatAddedMonth,
  formatProjectedDate,
  formatRecurringAmount,
  isValidBillingDay,
  isValidRecurringAmount,
  normalizeRecurringForm,
  sortRecurringItems,
  type RecurringFormState,
  type RecurringSort,
} from "./_lib/recurring"
import {
  buildRecurringSeriesEntries,
  formatCommitmentRowSubtitle,
  getOccurrenceStatusLabel,
  type CommitmentOccurrenceStatus,
  type RecurringSeriesEntry,
} from "./_lib/recurring-series"

type RecurringFilter = "all" | "upcoming" | "logged" | "changes"
type DetailTrayMode = "details" | "schedule_change"

export default function RecurringSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(getCurrentMonthKey())
  const [recurringSort, setRecurringSort] = useState<RecurringSort>("amount_desc")
  const [mobileFilter, setMobileFilter] = useState<RecurringFilter>("all")
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<RecurringFormState>(() => emptyForm(getCurrentMonthKey()))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<RecurringFormState | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailSeries, setDetailSeries] = useState<RecurringExpenseSeriesResponse | null>(null)
  const [isSeriesLoading, setIsSeriesLoading] = useState(false)
  const [detailTrayMode, setDetailTrayMode] = useState<DetailTrayMode>("details")
  const [scheduleChangeAmount, setScheduleChangeAmount] = useState("")
  const [scheduleChangeEffectiveMonth, setScheduleChangeEffectiveMonth] = useState(getNextMonthKey(getCurrentMonthKey()))
  const [scheduleChangeBillingType, setScheduleChangeBillingType] = useState<RecurringBillingType>("day_of_month")
  const [scheduleChangeBillingDay, setScheduleChangeBillingDay] = useState("1")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [isMutating, setIsMutating] = useState(false)
  const { data, tags, cards, isLoading, error, setTags, setCards, setError, loadData } = useRecurringData(month)
  const editingItem = data?.items.find((item) => item.id === editingId) ?? null
  const seriesEntries = useMemo(
    () => buildRecurringSeriesEntries(data?.items ?? [], month),
    [data?.items, month]
  )
  const detailEntry = seriesEntries.find((entry) => entry.currentItem.id === detailId) ?? null
  const detailItem = detailEntry?.currentItem ?? null
  const hasEditingChanges = Boolean(
    editingForm &&
    editingItem &&
    JSON.stringify(normalizeRecurringForm(editingForm)) !== JSON.stringify(normalizeRecurringForm(formFromItem(editingItem)))
  )

  useEffect(() => {
    if (searchParams.get("start") !== "1") {
      return
    }

    setShowNew(true)
    router.replace("/settings/recurring")
  }, [router, searchParams])

  useEffect(() => {
    setNewForm((previous) => {
      if (previous.tag_id) {
        return previous
      }
      return { ...previous, tag_id: tags[0]?.id ?? "" }
    })
  }, [tags])

  useEffect(() => {
    if (!detailItem) {
      setDetailSeries(null)
      setIsSeriesLoading(false)
      setDetailTrayMode("details")
      return
    }

    let cancelled = false
    setIsSeriesLoading(true)
    setDetailSeries({
      series_id: detailEntry?.seriesId ?? detailItem.series_id,
      items: detailEntry?.seriesItems ?? [detailItem],
    })

    void apiClient.getRecurringExpenseSeries(detailItem.id)
      .then((response) => {
        if (cancelled) {
          return
        }
        setDetailSeries(response)
      })
      .catch((err) => {
        if (cancelled) {
          return
        }
        if (err instanceof ApiError) {
          setError(formatApiErrorMessage(err))
        } else {
          setError("Unable to load recurring expense history")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSeriesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [detailEntry, detailItem, setError])

  const tagOptions = useMemo(() => tags, [tags])
  const activeItemsCount = useMemo(
    () => seriesEntries.length,
    [seriesEntries]
  )
  const loggedCount = useMemo(
    () => seriesEntries.filter((entry) => entry.occurrenceStatus === "logged").length,
    [seriesEntries]
  )
  const upcomingCount = useMemo(
    () => seriesEntries.filter((entry) => entry.occurrenceStatus === "upcoming").length,
    [seriesEntries]
  )
  const largestCommitment = useMemo(
    () => seriesEntries.reduce<{ expense: string; amount: number } | null>((largest, entry) => {
      const amount = Number(entry.currentItem.amount)
      if (!Number.isFinite(amount)) {
        return largest
      }
      if (!largest || amount > largest.amount) {
        return { expense: entry.currentItem.expense, amount }
      }
      return largest
    }, null),
    [seriesEntries]
  )
  const upcomingItems = useMemo(
    () => seriesEntries
      .filter((entry) => entry.occurrenceStatus === "upcoming")
      .map((entry) => entry.currentItem)
      .sort((first, second) => first.projected_date_for_month.localeCompare(second.projected_date_for_month))
      .slice(0, 5),
    [seriesEntries]
  )
  const sortedRecurringItems = useMemo(
    () => sortRecurringItems(seriesEntries.map((entry) => entry.currentItem), recurringSort),
    [seriesEntries, recurringSort]
  )
  const sortedSeriesEntries = useMemo(
    () => sortedRecurringItems.map((item) => seriesEntries.find((entry) => entry.currentItem.id === item.id)).filter(Boolean) as RecurringSeriesEntry[],
    [seriesEntries, sortedRecurringItems]
  )
  const filteredRecurringItems = useMemo(
    () => sortedSeriesEntries.filter((entry) => matchesRecurringFilter(entry, mobileFilter)),
    [mobileFilter, sortedSeriesEntries]
  )
  const openAddCommitment = () => {
    setShowNew(true)
  }
  const closeNewRecurringDialog = () => {
    setShowNew(false)
    setNewForm(emptyForm(month, tagOptions[0]?.id ?? ""))
  }
  const closeEditRecurringDialog = () => {
    setEditingId(null)
    setEditingForm(null)
  }
  const handleCreate = async () => {
    if (!newForm.expense.trim() || !newForm.tag_id || !isValidRecurringAmount(newForm.amount) || !isValidBillingDay(newForm)) {
      setError("Add a description, amount, tag, and valid billing day")
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      await apiClient.createRecurringExpense({
        expense: newForm.expense.trim(),
        amount: formatRecurringAmount(newForm.amount),
        category: newForm.category,
        tag_id: newForm.tag_id,
        card_id: newForm.card_id || null,
        billing_type: newForm.billing_type,
        billing_day: newForm.billing_type === "day_of_month" ? Number(newForm.billing_day || "1") : null,
        starts_month: newForm.starts_month,
        ends_month: newForm.ends_month || null,
        is_active: newForm.is_active,
      })
      setShowNew(false)
      setNewForm(emptyForm(month, tagOptions[0]?.id ?? ""))
      await loadData()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrorMessage(err))
      } else {
        setError("Unable to create recurring expense")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleCreateTag = async (name: string, iconKey: string): Promise<Tag> => {
    const created = await apiClient.createTag({
      name: name.trim(),
      icon_key: iconKey || null,
    })
    setTags((previous) => [...previous, created])
    return created
  }

  const handleCreateCard = async (name: string): Promise<CardType> => {
    const created = await apiClient.createCard({ name: name.trim() })
    setCards((previous) => sortCards([...previous, created]))
    return created
  }

  const handleSaveEdit = async () => {
    if (
      !editingId ||
      !editingForm ||
      !editingForm.expense.trim() ||
      !editingForm.tag_id ||
      !isValidRecurringAmount(editingForm.amount) ||
      !isValidBillingDay(editingForm)
    ) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      await apiClient.updateRecurringExpense(editingId, {
        expense: editingForm.expense.trim(),
        amount: formatRecurringAmount(editingForm.amount),
        category: editingForm.category,
        tag_id: editingForm.tag_id,
        card_id: editingForm.card_id || null,
        billing_type: editingForm.billing_type,
        billing_day: editingForm.billing_type === "day_of_month" ? Number(editingForm.billing_day || "1") : null,
        starts_month: editingForm.starts_month,
        ends_month: editingForm.ends_month || null,
        is_active: editingForm.is_active,
      })
      setEditingId(null)
      setEditingForm(null)
      await loadData()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrorMessage(err))
      } else {
        setError("Unable to update recurring expense")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      await apiClient.deleteRecurringExpense(deleteId)
      setDeleteId(null)
      setDetailId(null)
      if (editingId === deleteId) {
        setEditingId(null)
        setEditingForm(null)
      }
      await loadData()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrorMessage(err))
      } else {
        setError("Unable to delete recurring expense")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const startEdit = (item: RecurringExpense) => {
    setDetailId(null)
    setEditingId(item.id)
    setEditingForm(formFromItem(item))
  }

  const startScheduleChange = (item: RecurringExpense) => {
    setDetailId(item.id)
    setDetailTrayMode("schedule_change")
    setScheduleChangeAmount(item.amount)
    setScheduleChangeEffectiveMonth(getNextMonthKey(month))
    setScheduleChangeBillingType(item.billing_type)
    setScheduleChangeBillingDay(item.billing_day === null ? "1" : String(item.billing_day))
  }

  const handleScheduleChange = async () => {
    if (!detailItem || !isValidRecurringAmount(scheduleChangeAmount)) {
      setError("Add a valid amount before scheduling the change")
      return
    }

    if (scheduleChangeBillingType === "day_of_month") {
      const day = Number.parseInt(scheduleChangeBillingDay, 10)
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        setError("Enter a billing day from 1 to 31")
        return
      }
    }

    setIsMutating(true)
    setError(null)

    try {
      const payload: {
        effective_month: string
        amount?: string
        billing_type?: RecurringBillingType
        billing_day?: number | null
      } = {
        effective_month: scheduleChangeEffectiveMonth,
      }

      if (scheduleChangeAmount !== detailItem.amount) {
        payload.amount = formatRecurringAmount(scheduleChangeAmount)
      }

      if (
        scheduleChangeBillingType !== detailItem.billing_type
        || (scheduleChangeBillingType === "day_of_month" && Number(scheduleChangeBillingDay) !== (detailItem.billing_day ?? 1))
      ) {
        payload.billing_type = scheduleChangeBillingType
        payload.billing_day = scheduleChangeBillingType === "last_day" ? null : Number(scheduleChangeBillingDay)
      }

      await apiClient.scheduleRecurringExpenseChange(detailItem.id, payload)
      setDetailTrayMode("details")
      await loadData()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrorMessage(err))
      } else {
        setError("Unable to schedule recurring change")
      }
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 lg:max-w-6xl lg:px-8 lg:py-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to settings">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1">Monthly Commitments</h1>
          <Button
            variant="ghost"
            className="h-9 rounded-full px-3 lg:hidden"
            aria-label="Add commitment"
            onClick={openAddCommitment}
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm">Add</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-full overflow-x-hidden px-4 pt-3 sm:max-w-lg lg:max-w-6xl lg:px-8 lg:pt-8">
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground">
            See what this month already owes you, what has been logged, and what is still coming up.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-3 grid gap-3 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
          <div className="space-y-3 lg:space-y-4">
            <Card className="border-0 p-3 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="recurring-month" className="text-sm font-medium">Selected month</Label>
                <MonthPicker
                  id="recurring-month"
                  value={month}
                  onChange={setMonth}
                  placeholder="Select month"
                  className="w-full sm:w-[190px]"
                />
              </div>
              <div className="mt-4 space-y-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{formatAddedMonth(month)}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{formatCurrency(data?.committed_total ?? "0.00")} committed</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <p>{activeItemsCount} active</p>
                  <p>{loggedCount} logged</p>
                  <p>{upcomingCount} upcoming</p>
                </div>
                {largestCommitment ? (
                  <p className="text-sm text-muted-foreground">
                    Largest: <span className="font-medium text-foreground">{largestCommitment.expense}</span> · {formatCurrency(largestCommitment.amount.toFixed(2))}
                  </p>
                ) : null}
              </div>
            </Card>

            <div className="lg:hidden">
              <FormChipRail
                items={[
                  { value: "all", label: "All" },
                  { value: "upcoming", label: "Upcoming" },
                  { value: "logged", label: "Logged" },
                  { value: "changes", label: "Changes" },
                ]}
                value={mobileFilter}
                onValueChange={(value) => setMobileFilter(value as RecurringFilter)}
                ariaLabel="Filter commitments"
                fadeClassName="from-background via-background/80 to-transparent"
                chipClassName="h-9 px-3 text-xs"
              />
            </div>

            <Card className="overflow-hidden border-0 shadow-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 sm:px-5 sm:py-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Commitments</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatAddedMonth(month)}</p>
                </div>
                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  <div className="inline-flex max-w-full items-center rounded-lg border border-border/70 bg-background p-0.5">
                    <span className="hidden px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:inline">
                      Sort
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecurringSort("amount_desc")}
                      aria-label="Sort highest amount first"
                      title="Highest amount first"
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors lg:px-2",
                        recurringSort === "amount_desc"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">Highest</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecurringSort("amount_asc")}
                      aria-label="Sort lowest amount first"
                      title="Lowest amount first"
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors lg:px-2",
                        recurringSort === "amount_asc"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">Lowest</span>
                    </button>
                  </div>
                </div>
              </div>

              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <div className="p-4 sm:p-5">
                  <h3 className="text-sm font-semibold">No monthly commitments yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add rent, subscriptions, savings transfers, insurance, or other fixed monthly items so your month starts with a clearer picture.
                  </p>
                  <Button className="mt-4 rounded-xl" onClick={openAddCommitment}>
                    <Plus className="h-4 w-4" />
                    Add commitment
                  </Button>
                </div>
              )}

              {!isLoading && seriesEntries.length > 0 && filteredRecurringItems.length === 0 ? (
                <div className="p-4 sm:p-5">
                  <h3 className="text-sm font-semibold">{getFilteredEmptyState(mobileFilter).title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{getFilteredEmptyState(mobileFilter).description}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredRecurringItems.map((entry) => (
                    <RecurringItemRow
                      key={entry.seriesId}
                      item={entry.currentItem}
                      subtitle={formatCommitmentRowSubtitle(entry.currentItem, entry.occurrenceStatus)}
                      showScheduledChange={entry.seriesState === "has_scheduled_change"}
                      onOpen={() => {
                        setDetailTrayMode("details")
                        setDetailId(entry.currentItem.id)
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <aside className="hidden space-y-4 lg:block">
            <Card className="border-0 p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Committed total</span>
                  <span className="font-medium">{formatCurrency(data?.committed_total ?? "0.00")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Active commitments</span>
                  <span className="font-medium">{activeItemsCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Logged this month</span>
                  <span className="font-medium">{loggedCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Upcoming this month</span>
                  <span className="font-medium">{upcomingCount}</span>
                </div>
              </div>
            </Card>

            <Card className="border-0 p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-sm font-semibold">Actions</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Keep fixed monthly items visible before the rest of the budget starts moving.
              </p>
              <Button className="mt-5 w-full rounded-xl" onClick={openAddCommitment}>
                <Plus className="h-4 w-4" />
                Add commitment
              </Button>
            </Card>

            <Card className="border-0 p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Upcoming this month</h2>
              <div className="mt-4 space-y-3">
                {upcomingItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing else upcoming this month.</p>
                )}
                {upcomingItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{formatProjectedDate(item.projected_date_for_month)}</span>
                    <span className="truncate font-medium">{item.expense}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </main>

      <ResponsiveDialog
        open={showNew}
        onOpenChange={(open) => {
          if (open) {
            setShowNew(true)
          } else {
            closeNewRecurringDialog()
          }
        }}
        title="New Commitment"
        description="Add a monthly commitment so it counts toward your budget upfront."
        desktopClassName="sm:max-w-2xl"
        contentClassName="max-h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] sm:max-h-[90vh]"
        headerClassName="relative z-10 px-5 pb-3 pt-2 sm:px-6 sm:pb-4 sm:pt-5"
        bodyClassName="min-w-0 overflow-x-hidden p-0"
      >
        <RecurringForm
          form={newForm}
          tags={tagOptions}
          cards={cards}
          isMutating={isMutating}
          saveLabel="Create commitment"
          onChange={setNewForm}
          onCreateTag={handleCreateTag}
          onCreateCard={handleCreateCard}
          onCancel={closeNewRecurringDialog}
          onSave={() => void handleCreate()}
        />
      </ResponsiveDialog>

      <ResponsiveDialog
        open={editingId !== null && editingForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditRecurringDialog()
          }
        }}
        title="Edit Commitment"
        description="Update the monthly rule for future budget planning."
        desktopClassName="sm:max-w-2xl"
        contentClassName="max-h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] sm:max-h-[90vh]"
        headerClassName="relative z-10 px-5 pb-3 pt-2 sm:px-6 sm:pb-4 sm:pt-5"
        bodyClassName="min-w-0 overflow-x-hidden p-0"
      >
        {editingForm && (
          <RecurringForm
            form={editingForm}
            tags={tagOptions}
            cards={cards}
            isMutating={isMutating}
            canSave={hasEditingChanges}
            saveLabel="Save changes"
            onChange={setEditingForm}
            onCreateTag={handleCreateTag}
            onCreateCard={handleCreateCard}
            onCancel={closeEditRecurringDialog}
            onSave={() => void handleSaveEdit()}
          />
        )}
      </ResponsiveDialog>

      <RecurringDetailDialog
        item={detailItem}
        seriesItems={detailSeries?.items ?? []}
        isSeriesLoading={isSeriesLoading}
        open={detailId !== null && detailItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
            setDetailTrayMode("details")
          }
        }}
        selectedMonth={month}
        mode={detailTrayMode}
        scheduleChangeAmount={scheduleChangeAmount}
        scheduleChangeEffectiveMonth={scheduleChangeEffectiveMonth}
        scheduleChangeBillingType={scheduleChangeBillingType}
        scheduleChangeBillingDay={scheduleChangeBillingDay}
        isMutating={isMutating}
        onScheduleChangeAmountChange={setScheduleChangeAmount}
        onScheduleChangeEffectiveMonthChange={setScheduleChangeEffectiveMonth}
        onScheduleChangeBillingTypeChange={setScheduleChangeBillingType}
        onScheduleChangeBillingDayChange={setScheduleChangeBillingDay}
        onScheduleChangeBack={() => setDetailTrayMode("details")}
        onScheduleChangeSubmit={() => void handleScheduleChange()}
        onEdit={startEdit}
        onScheduleChange={startScheduleChange}
        onDelete={(item) => {
          setDetailId(null)
          setDeleteId(item.id)
        }}
      />

      <ResponsiveConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setDeleteId(null)
          }
        }}
        title="Delete recurring expense?"
        description="This stops future automatic monthly entries. Existing transactions stay unchanged."
        confirmLabel={isMutating ? "Deleting..." : "Delete"}
        confirmVariant="destructive"
        confirmDisabled={isMutating}
        closeDisabled={isMutating}
        onConfirm={() => void handleDelete()}
      />

      <BottomNav />
    </div>
  )
}

function matchesRecurringFilter(entry: RecurringSeriesEntry, filter: RecurringFilter): boolean {
  switch (filter) {
    case "all":
      return true
    case "upcoming":
      return entry.occurrenceStatus === "upcoming"
    case "logged":
      return entry.occurrenceStatus === "logged"
    case "changes":
      return entry.seriesState === "has_scheduled_change"
  }
}

function getFilteredEmptyState(filter: RecurringFilter): { title: string; description: string } {
  switch (filter) {
    case "all":
    case "upcoming":
      return {
        title: "Nothing else upcoming this month",
        description: "All active commitments for this month have already been logged or completed.",
      }
    case "logged":
      return {
        title: "Nothing logged yet",
        description: "No commitments for this month have been logged yet.",
      }
    case "changes":
      return {
        title: "No scheduled changes yet",
        description: "None of this month's commitments have a future scheduled version yet.",
      }
  }
}

function formatApiErrorMessage(error: ApiError): string {
  const detail = error.error.details?.[0]
  if (!detail?.message) {
    return error.error.message
  }

  return `${error.error.message} ${detail.message}`
}
