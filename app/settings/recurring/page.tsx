"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpNarrowWide, Plus, Repeat } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import { getCurrentMonthKey } from "@/lib/date-filters"
import type {
  RecurringExpense,
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
  formatRecurringGroupDate,
  groupRecurringByProjectedDate,
  isValidBillingDay,
  isValidRecurringAmount,
  normalizeRecurringForm,
  sortRecurringItems,
  type RecurringFormState,
  type RecurringSort,
} from "./_lib/recurring"

export default function RecurringSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(getCurrentMonthKey())
  const [recurringSort, setRecurringSort] = useState<RecurringSort>("date_asc")
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<RecurringFormState>(() => emptyForm(getCurrentMonthKey()))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<RecurringFormState | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [isMutating, setIsMutating] = useState(false)
  const { data, tags, cards, isLoading, error, setTags, setCards, setError, loadData } = useRecurringData(month)
  const editingItem = data?.items.find((item) => item.id === editingId) ?? null
  const detailItem = data?.items.find((item) => item.id === detailId) ?? null
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

  const tagOptions = useMemo(() => tags, [tags])
  const activeItemsCount = useMemo(
    () => data?.items.filter((item) => item.is_active).length ?? 0,
    [data?.items]
  )
  const inactiveItemsCount = Math.max((data?.items_count ?? 0) - activeItemsCount, 0)
  const upcomingItems = useMemo(
    () => [...(data?.items ?? [])]
      .filter((item) => item.is_active)
      .sort((first, second) => first.projected_date_for_month.localeCompare(second.projected_date_for_month))
      .slice(0, 3),
    [data?.items]
  )
  const sortedRecurringItems = useMemo(
    () => sortRecurringItems(data?.items ?? [], recurringSort),
    [data?.items, recurringSort]
  )
  const recurringGroups = useMemo(
    () => groupRecurringByProjectedDate(sortedRecurringItems),
    [sortedRecurringItems]
  )
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
        setError(err.error.message)
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
    setCards((previous) => [...previous, created])
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
        setError(err.error.message)
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
        setError(err.error.message)
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

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 lg:max-w-6xl lg:px-8 lg:py-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to settings">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1">Recurring</h1>
          <Button
            variant="ghost"
            className="h-9 rounded-full px-3 lg:hidden"
            aria-label="Add recurring expense"
            onClick={() => setShowNew(true)}
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm">Add</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-full overflow-x-hidden px-4 pt-3 sm:max-w-lg lg:max-w-6xl lg:px-8 lg:pt-8">
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground">
            Monthly bills are added upfront so your budget reflects committed spending.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-3 grid gap-3 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
          <div className="space-y-3 lg:space-y-4">
            <Card className="border-0 p-3 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="recurring-month" className="text-sm font-medium">Month</Label>
                <MonthPicker
                  id="recurring-month"
                  value={month}
                  onChange={setMonth}
                  placeholder="Select month"
                  className="w-full sm:w-[190px]"
                />
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:mt-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Committed total</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{formatCurrency(data?.committed_total ?? "0.00")}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-muted-foreground">Recurring items</p>
                  <p className="mt-1 text-xl font-semibold">{data?.items_count ?? 0}</p>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-0 shadow-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 sm:px-5 sm:py-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Recurring items</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatAddedMonth(month)}</p>
                </div>
                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    <p>{activeItemsCount} Active</p>
                    {inactiveItemsCount > 0 && <p>{inactiveItemsCount} Inactive</p>}
                  </div>
                  <div className="inline-flex max-w-full items-center rounded-lg border border-border/70 bg-background p-0.5">
                    <span className="hidden px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:inline">
                      Sort
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecurringSort("date_desc")}
                      aria-label="Sort newest first"
                      title="Newest first"
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors lg:px-2",
                        recurringSort === "date_desc"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">Newest</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecurringSort("date_asc")}
                      aria-label="Sort oldest first"
                      title="Oldest first"
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors lg:px-2",
                        recurringSort === "date_asc"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">Oldest</span>
                    </button>
                  </div>
                </div>
              </div>

              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <div className="p-4 text-sm text-muted-foreground sm:p-5">
                  No recurring expenses yet.
                </div>
              )}

              <div>
                {Array.from(recurringGroups.entries()).map(([date, items]) => (
                  <div key={date}>
                    <div className="bg-secondary/40 px-4 py-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {formatRecurringGroupDate(date)}
                      </span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {items.map((item) => (
                        <RecurringItemRow key={item.id} item={item} onOpen={() => setDetailId(item.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <aside className="hidden space-y-4 lg:block">
            <Card className="border-0 p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-sm font-semibold">Monthly commitments</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use recurring items for bills you expect every month. They are included upfront for the selected month.
              </p>
              <Button className="mt-5 w-full rounded-xl" onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" />
                Add recurring expense
              </Button>
            </Card>

            <Card className="border-0 p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Upcoming this month</h2>
              <div className="mt-4 space-y-3">
                {upcomingItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active recurring items for {formatAddedMonth(month)}.</p>
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
        title="New Recurring Bill"
        description="Add a monthly bill so it counts toward your budget upfront."
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
          saveLabel="Create recurring expense"
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
        title="Edit Recurring Bill"
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
        open={detailId !== null && detailItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
          }
        }}
        onEdit={startEdit}
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
