"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpNarrowWide, CalendarIcon, ChevronLeft, ChevronRight, CreditCard, Folder, Pencil, Plus, Repeat, Tag as TagGlyph, Trash2, X } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { AmountInput } from "@/components/budget/amount-input"
import { FormChipRail, type FormChipRailItem } from "@/components/budget/form-chip-rail"
import { InlineCreateCardControl, InlineCreateTagControl } from "@/components/budget/inline-create-controls"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError, apiClient } from "@/lib/api/client"
import { formatDateValue, formatMonthValue, getCurrentMonthKey, parseMonthKey } from "@/lib/date-filters"
import { asNumber, toDecimalString } from "@/lib/income-breakdown"
import type {
  Category,
  RecurringBillingType,
  RecurringExpense,
  RecurringExpensesResponse,
  Tag,
  Card as CardType,
} from "@/lib/api/types"
import { formatCurrency, getCategoryColorClass } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"

interface RecurringFormState {
  expense: string
  amount: string
  category: Category
  tag_id: string
  card_id: string
  billing_type: RecurringBillingType
  billing_day: string
  starts_month: string
  ends_month: string
  is_active: boolean
}

type RecurringSort = "date_asc" | "date_desc"

const categoryConfig = {
  needs: { label: "Needs", selectedClassName: "bg-needs/15" },
  wants: { label: "Wants", selectedClassName: "bg-wants/15" },
  savings: { label: "Savings", selectedClassName: "bg-savings/15" },
} as const

function formatRecurringAmount(value: string): string {
  if (asNumber(value) <= 0) {
    return "0.00"
  }

  return toDecimalString(value)
}

function emptyForm(month: string, tagId = ""): RecurringFormState {
  return {
    expense: "",
    amount: "",
    category: "needs",
    tag_id: tagId,
    card_id: "",
    billing_type: "day_of_month",
    billing_day: "1",
    starts_month: month,
    ends_month: "",
    is_active: true,
  }
}

function formFromItem(item: RecurringExpense): RecurringFormState {
  return {
    expense: item.expense,
    amount: item.amount,
    category: item.category,
    tag_id: item.tag.id,
    card_id: item.card?.id ?? "",
    billing_type: item.billing_type,
    billing_day: item.billing_day === null ? "1" : String(item.billing_day),
    starts_month: item.starts_month,
    ends_month: item.ends_month ?? "",
    is_active: item.is_active,
  }
}

function normalizeRecurringForm(form: RecurringFormState) {
  return {
    expense: form.expense.trim(),
    amount: formatRecurringAmount(form.amount),
    category: form.category,
    tag_id: form.tag_id,
    card_id: form.card_id || null,
    billing_type: form.billing_type,
    billing_day: form.billing_type === "day_of_month"
      ? Math.min(Math.max(Number.parseInt(form.billing_day || "1", 10) || 1, 1), 31)
      : null,
    starts_month: form.starts_month,
    ends_month: form.ends_month || null,
    is_active: form.is_active,
  }
}

function isValidRecurringAmount(value: string): boolean {
  return asNumber(value) > 0
}

function isValidBillingDay(form: RecurringFormState): boolean {
  if (form.billing_type === "last_day") {
    return true
  }

  const day = Number.parseInt(form.billing_day || "", 10)
  return Number.isInteger(day) && day >= 1 && day <= 31
}

function formatProjectedDate(date: string): string {
  return formatDateValue(date, { month: "short", day: "numeric" })
}

function formatRecurringGroupDate(date: string): string {
  return formatDateValue(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatAddedMonth(month: string): string {
  return formatMonthValue(month, { month: "long", year: "numeric" }) ?? month
}

function formatBillingSchedule(item: RecurringExpense): string {
  if (item.billing_type === "last_day") {
    return "Last day monthly"
  }

  return `Day ${item.billing_day} monthly`
}

function groupRecurringByProjectedDate(items: RecurringExpense[]): Map<string, RecurringExpense[]> {
  const groups = new Map<string, RecurringExpense[]>()

  items.forEach((item) => {
    const dateKey = item.projected_date_for_month
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(item)
  })

  return groups
}

function sortRecurringItems(items: RecurringExpense[], sort: RecurringSort): RecurringExpense[] {
  return [...items].sort((first, second) => {
    const dateCompare = first.projected_date_for_month.localeCompare(second.projected_date_for_month)
    if (dateCompare !== 0) {
      return sort === "date_desc" ? -dateCompare : dateCompare
    }

    return first.expense.localeCompare(second.expense)
  })
}

function monthValueFromParts(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

const monthPickerMonths = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: format(new Date(2026, index, 1), "MMM"),
}))

interface MonthPickerProps {
  id?: string
  value: string
  onChange: (next: string) => void
  placeholder: string
  className?: string
  allowClear?: boolean
  disabled?: boolean
}

function MonthPicker({
  id,
  value,
  onChange,
  placeholder,
  className,
  allowClear = false,
  disabled = false,
}: MonthPickerProps) {
  const selectedMonth = parseMonthKey(value)
  const displayLabel = selectedMonth ? format(selectedMonth, "MMMM yyyy") : placeholder
  const currentMonthValue = getCurrentMonthKey()
  const initialYear = selectedMonth?.getFullYear() ?? parseMonthKey(currentMonthValue)?.getFullYear() ?? new Date().getFullYear()
  const [visibleYear, setVisibleYear] = useState(initialYear)

  useEffect(() => {
    if (selectedMonth) {
      setVisibleYear(selectedMonth.getFullYear())
    }
  }, [value])

  return (
    <div className="space-y-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={`Select month. Current selection: ${displayLabel}`}
            className={cn(
              "h-10 rounded-xl justify-start text-left font-normal",
              !selectedMonth && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{displayLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(calc(100vw-2rem),21rem)] rounded-2xl p-3" align="end" avoidCollisions>
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Previous year"
              onClick={() => setVisibleYear((year) => year - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold">{visibleYear}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Next year"
              onClick={() => setVisibleYear((year) => year + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {monthPickerMonths.map((monthOption) => {
              const monthValue = monthValueFromParts(visibleYear, monthOption.index)
              const isSelected = value === monthValue
              const isCurrent = currentMonthValue === monthValue

              return (
                <button
                  key={monthValue}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChange(monthValue)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/60 bg-muted/20 text-foreground hover:bg-muted/60",
                    isCurrent && !isSelected && "border-primary/40"
                  )}
                >
                  {monthOption.label}
                </button>
              )
            })}
          </div>

          <Button
            type="button"
            variant="ghost"
            className="mt-3 h-9 w-full rounded-xl text-sm text-muted-foreground"
            onClick={() => {
              const currentMonth = parseMonthKey(currentMonthValue)
              setVisibleYear(currentMonth?.getFullYear() ?? new Date().getFullYear())
              onChange(currentMonthValue)
            }}
          >
            Current month
          </Button>
        </PopoverContent>
      </Popover>

      {allowClear && value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => onChange("")}
          disabled={disabled}
        >
          Clear
        </Button>
      )}
    </div>
  )
}

export default function RecurringSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(getCurrentMonthKey())
  const [recurringSort, setRecurringSort] = useState<RecurringSort>("date_asc")
  const [data, setData] = useState<RecurringExpensesResponse | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<CardType[]>([])

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<RecurringFormState>(() => emptyForm(getCurrentMonthKey()))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<RecurringFormState | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editingItem = data?.items.find((item) => item.id === editingId) ?? null
  const detailItem = data?.items.find((item) => item.id === detailId) ?? null
  const hasEditingChanges = Boolean(
    editingForm &&
    editingItem &&
    JSON.stringify(normalizeRecurringForm(editingForm)) !== JSON.stringify(normalizeRecurringForm(formFromItem(editingItem)))
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [recurringResponse, tagsResponse, cardsResponse] = await Promise.all([
        apiClient.getRecurringExpenses(month),
        apiClient.getTags(),
        apiClient.getCards(),
      ])
      setData(recurringResponse)
      setTags(tagsResponse.items)
      setCards(cardsResponse.items)
      setNewForm((previous) => {
        if (previous.tag_id) {
          return previous
        }
        return { ...previous, tag_id: tagsResponse.items[0]?.id ?? "" }
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load recurring expenses")
      }
    } finally {
      setIsLoading(false)
    }
  }, [month])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (searchParams.get("start") !== "1") {
      return
    }

    setShowNew(true)
    router.replace("/settings/recurring")
  }, [router, searchParams])

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

interface RecurringFormProps {
  form: RecurringFormState
  tags: Tag[]
  cards: CardType[]
  isMutating: boolean
  canSave?: boolean
  saveLabel: string
  onChange: (next: RecurringFormState) => void
  onCreateTag: (name: string, iconKey: string) => Promise<Tag>
  onCreateCard: (name: string) => Promise<CardType>
  onCancel: () => void
  onSave: () => void
}

interface RecurringDetailDialogProps {
  item: RecurringExpense | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (item: RecurringExpense) => void
  onDelete: (item: RecurringExpense) => void
}

function RecurringItemRow({
  item,
  onOpen,
}: {
  item: RecurringExpense
  onOpen: () => void
}) {
  const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)

  return (
    <button
      type="button"
      className="group grid w-full cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)_auto_1rem] items-center gap-2 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:gap-3"
      aria-label={`Open details for ${item.expense}`}
      onClick={onOpen}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", getCategoryColorClass(item.category))}>
        <TagIcon className="h-5 w-5 text-white" />
      </div>

      <div className="min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold">{item.expense}</p>
          <span className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            item.is_active
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {item.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-foreground">
            <TagGlyph className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[7rem] truncate sm:max-w-[9rem]">{item.tag.name}</span>
          </span>
          {item.card && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
              <CreditCard className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="max-w-[6rem] truncate sm:max-w-[9rem]">{item.card.name}</span>
            </span>
          )}
          <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
            <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[8rem] truncate sm:max-w-[11rem]">{formatBillingSchedule(item)}</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Next: {formatProjectedDate(item.projected_date_for_month)}
        </p>
      </div>

      <div className="min-w-[4.25rem] shrink-0 text-right sm:min-w-[4.75rem]">
        <p className="whitespace-nowrap text-sm font-semibold">
          {formatCurrency(item.amount)}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" />
    </button>
  )
}

function formatProjectedDateLong(date: string): string {
  return formatDateValue(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function RecurringDetailDialog({
  item,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: RecurringDetailDialogProps) {
  if (!item) {
    return null
  }

  const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item.expense}
      description={`${formatCurrency(item.amount)} / month`}
      mobileSize="compact"
      desktopClassName="sm:w-[min(calc(100dvw-2rem),44rem)] sm:max-w-[44rem]"
      headerClassName="px-4 pb-3 pt-2 sm:px-7 sm:pb-4 sm:pt-5"
      bodyClassName="px-4 py-4 sm:px-7 sm:py-6"
      footerClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7 sm:pt-4 sm:pb-6"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="order-2 h-11 rounded-xl sm:h-12"
            onClick={() => onEdit(item)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="order-1 h-11 rounded-xl text-destructive hover:text-destructive sm:h-12"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary sm:h-14 sm:w-14">
            <TagIcon className="h-5 w-5 text-foreground sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">Recurring bill details</p>
            <p className="mt-1 text-sm text-muted-foreground">Review schedule, budget group, and card assignment before making changes.</p>
          </div>
        </div>

        <div className="rounded-2xl bg-secondary/50 p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <DetailRow
              className="col-span-2"
              icon={<CalendarIcon className="h-5 w-5 text-muted-foreground" />}
              label="Schedule"
              value={formatBillingSchedule(item)}
              detail={`Next: ${formatProjectedDateLong(item.projected_date_for_month)}`}
            />
            <DetailRow
              icon={<Folder className="h-5 w-5 text-muted-foreground" />}
              label="Category"
              value={categoryConfig[item.category].label}
            />
            <DetailRow
              icon={<TagGlyph className="h-5 w-5 text-muted-foreground" />}
              label="Tag"
              value={item.tag.name}
            />
            <DetailRow
              icon={<CreditCard className="h-5 w-5 text-muted-foreground" />}
              label="Card"
              value={item.card?.name ?? "No card"}
            />
            <DetailRow
              icon={<Repeat className="h-5 w-5 text-muted-foreground" />}
              label="Status"
              value={item.is_active ? "Active" : "Inactive"}
            />
            <DetailRow
              className="col-span-2"
              icon={<CalendarIcon className="h-5 w-5 text-muted-foreground" />}
              label="Active months"
              value={`Starts ${formatAddedMonth(item.starts_month)}`}
              detail={item.ends_month ? `Ends ${formatAddedMonth(item.ends_month)}` : "No end month"}
            />
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  )
}

function DetailRow({
  icon,
  label,
  value,
  detail,
  className,
}: {
  icon: ReactNode
  label: string
  value: string
  detail?: string
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background sm:h-10 sm:w-10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
        <p className="truncate text-sm font-medium sm:text-base">{value}</p>
        {detail && <p className="truncate text-xs text-muted-foreground sm:text-sm">{detail}</p>}
      </div>
    </div>
  )
}

function RecurringForm({
  form,
  tags,
  cards,
  isMutating,
  canSave = true,
  saveLabel,
  onChange,
  onCreateTag,
  onCreateCard,
  onCancel,
  onSave,
}: RecurringFormProps) {
  const [touched, setTouched] = useState({
    amount: false,
    expense: false,
    billing_day: false,
  })
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagIconKey, setNewTagIconKey] = useState("")
  const [showNewCard, setShowNewCard] = useState(false)
  const [newCardName, setNewCardName] = useState("")
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [isCreatingCard, setIsCreatingCard] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const expenseInputRef = useRef<HTMLInputElement>(null)
  const hasAmount = form.amount.trim() !== ""
  const hasExpense = form.expense.trim() !== ""
  const amountIsValid = isValidRecurringAmount(form.amount)
  const billingDayIsValid = isValidBillingDay(form)
  const canSubmit = Boolean(canSave && hasExpense && form.tag_id && amountIsValid && billingDayIsValid)
  const amountErrorId = "recurring-amount-error"
  const descriptionErrorId = "recurring-description-error"
  const billingDayErrorId = "recurring-billing-day-error"
  const showAmountError = (submitAttempted || touched.amount) && !amountIsValid
  const showDescriptionError = (submitAttempted || touched.expense) && !hasExpense
  const showBillingDayError = (submitAttempted || touched.billing_day) && !billingDayIsValid

  const focusExpenseInput = () => {
    window.requestAnimationFrame(() => {
      expenseInputRef.current?.focus()
    })
  }

  const handleCreateInlineTag = async () => {
    const name = newTagName.trim()
    if (!name || isCreatingTag) {
      return
    }

    setIsCreatingTag(true)
    setInlineError(null)

    try {
      const created = await onCreateTag(name, newTagIconKey)
      onChange({ ...form, tag_id: created.id })
      setShowNewTag(false)
      setNewTagName("")
      setNewTagIconKey("")
    } catch (err) {
      if (err instanceof ApiError) {
        setInlineError(err.error.message)
      } else {
        setInlineError("Unable to create tag")
      }
    } finally {
      setIsCreatingTag(false)
    }
  }

  const handleCreateInlineCard = async () => {
    const name = newCardName.trim()
    if (!name || isCreatingCard) {
      return
    }

    setIsCreatingCard(true)
    setInlineError(null)

    try {
      const created = await onCreateCard(name)
      onChange({ ...form, card_id: created.id })
      setShowNewCard(false)
      setNewCardName("")
    } catch (err) {
      if (err instanceof ApiError) {
        setInlineError(err.error.message)
      } else {
        setInlineError("Unable to create card")
      }
    } finally {
      setIsCreatingCard(false)
    }
  }

  const handleSubmit = () => {
    if (!canSubmit) {
      setSubmitAttempted(true)
      setTouched({ amount: true, expense: true, billing_day: true })
      return
    }

    onSave()
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="min-w-0 max-w-full flex-1 space-y-4 overflow-x-hidden px-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-28 sm:pt-4">
        <FormSection title="Expense">
          <div>
            <AmountInput
              ref={amountInputRef}
              id="recurring-amount"
              name="recurring_amount"
              value={form.amount}
              onValueChange={(amount) => {
                setSubmitAttempted(false)
                onChange({ ...form, amount })
              }}
              onEnter={focusExpenseInput}
              onBlur={() => setTouched((previous) => ({ ...previous, amount: true }))}
              ariaInvalid={showAmountError}
              ariaDescribedBy={showAmountError ? amountErrorId : undefined}
            />
            {showAmountError && (
              <p id={amountErrorId} className="mt-2.5 text-center text-xs text-destructive">Amount must be greater than $0.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-description" className="text-sm font-medium">Description</Label>
            <div className="relative">
              <Input
                ref={expenseInputRef}
                id="recurring-description"
                value={form.expense}
                onChange={(e) => onChange({ ...form, expense: e.target.value })}
                onBlur={() => setTouched((previous) => ({ ...previous, expense: true }))}
                placeholder="What bill is this?"
                enterKeyHint={form.tag_id && amountIsValid ? "done" : "next"}
                aria-invalid={showDescriptionError}
                aria-describedby={showDescriptionError ? descriptionErrorId : undefined}
                className="h-11 rounded-xl border-border/60 bg-transparent focus:border-foreground/20 dark:bg-transparent sm:h-10"
              />
            </div>
            {showDescriptionError && (
              <p id={descriptionErrorId} className="text-xs text-destructive">Description is required.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Tag</Label>
              {!showNewTag && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTagIconKey("")
                    setShowNewTag(true)
                  }}
                  className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New tag
                </button>
              )}
            </div>

            {showNewTag ? (
              <InlineCreateTagControl
                name={newTagName}
                iconKey={newTagIconKey}
                onNameChange={setNewTagName}
                onIconKeyChange={setNewTagIconKey}
                onCancel={() => {
                  setShowNewTag(false)
                  setNewTagName("")
                  setNewTagIconKey("")
                }}
                onSubmit={() => void handleCreateInlineTag()}
                isSubmitting={isCreatingTag}
                subtitle="It will be selected for this recurring expense."
                compact
              />
            ) : (
              <div className="min-w-0 max-w-full overflow-hidden">
                {tags.length > 0 ? (
                  <FormChipRail
                    items={tags.map((tag) => {
                      const TagIcon = getTagIcon(tag.name, tag.icon_key)
                      return {
                        value: tag.id,
                        label: tag.name.trim().replace(/\s+/g, " "),
                        icon: <TagIcon className="h-4 w-4 shrink-0" />,
                        ariaLabel: tag.name,
                        title: tag.name,
                      } satisfies FormChipRailItem
                    })}
                    value={form.tag_id}
                    onValueChange={(value) => onChange({ ...form, tag_id: value })}
                    ariaLabel="Choose a tag"
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                    Create a tag to use it for this recurring expense.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 max-w-full space-y-2">
            <Label className="text-sm font-medium">Category</Label>
            <div className="grid min-w-0 max-w-full grid-cols-3 gap-2">
              {(["needs", "wants", "savings"] as const).map((category) => {
                const config = categoryConfig[category]
                const isSelected = form.category === category

                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChange({ ...form, category })}
                    className={cn(
                      "relative h-10 cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 sm:h-11",
                      isSelected
                        ? `border-primary ${config.selectedClassName} text-foreground shadow-sm`
                        : "bg-muted/60 text-foreground hover:bg-muted"
                    )}
                  >
                    {config.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-w-0 max-w-full space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Card <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              {!showNewCard && (
                <button
                  type="button"
                  onClick={() => setShowNewCard(true)}
                  className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New card
                </button>
              )}
            </div>

            {showNewCard ? (
              <InlineCreateCardControl
                name={newCardName}
                onNameChange={setNewCardName}
                onCancel={() => {
                  setShowNewCard(false)
                  setNewCardName("")
                }}
                onSubmit={() => void handleCreateInlineCard()}
                isSubmitting={isCreatingCard}
                subtitle="It will be selected for this recurring expense."
                compact
              />
            ) : (
              <FormChipRail
                items={[
                  {
                    value: "",
                    label: "No card",
                    icon: <CreditCard className="h-4 w-4 shrink-0" />,
                    selectedTone: "neutral",
                  },
                  ...cards.map((card) => ({
                    value: card.id,
                    label: card.name.trim().replace(/\s+/g, " "),
                    icon: <CreditCard className="h-4 w-4 shrink-0" />,
                    ariaLabel: card.name,
                    title: card.name,
                  })),
                ]}
                value={form.card_id}
                onValueChange={(value) => onChange({ ...form, card_id: value })}
                ariaLabel="Choose a card"
              />
            )}
          </div>
        </FormSection>

        <FormSection title="Schedule" description="Choose when this bill should be added each month.">
          <div className="grid min-w-0 max-w-full grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label className="text-sm">Billing rule</Label>
              <Select
                value={form.billing_type}
                onValueChange={(value) => onChange({ ...form, billing_type: value as RecurringBillingType })}
              >
                <SelectTrigger className="h-11 rounded-xl border-border/60 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day_of_month">Specific day</SelectItem>
                  <SelectItem value="last_day">Last day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-2">
              <Label className="text-sm">Billing day</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.billing_type === "last_day" ? "" : form.billing_day}
                onChange={(e) => onChange({ ...form, billing_day: e.target.value })}
                onBlur={() => setTouched((previous) => ({ ...previous, billing_day: true }))}
                disabled={form.billing_type === "last_day"}
                placeholder={form.billing_type === "last_day" ? "Auto" : "1-31"}
                inputMode="numeric"
                aria-invalid={showBillingDayError}
                aria-describedby={showBillingDayError ? billingDayErrorId : undefined}
                className="h-10 rounded-xl border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {showBillingDayError && (
                <p id={billingDayErrorId} className="text-xs text-destructive">Enter a day from 1 to 31.</p>
              )}
            </div>
          </div>

          <div className="grid min-w-0 max-w-full gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label className="text-sm">Starts</Label>
              <MonthPicker
                value={form.starts_month}
                onChange={(value) => onChange({ ...form, starts_month: value })}
                placeholder="Select month"
                className="w-full"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-sm">Ends</Label>
              <MonthPicker
                value={form.ends_month}
                onChange={(value) => onChange({ ...form, ends_month: value })}
                placeholder="No end month"
                className="w-full"
                allowClear
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Status">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
            <div>
              <Label className="text-sm">Active</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Active recurring expenses are added for eligible months.</p>
            </div>
            <Switch
              aria-label="Recurring expense active"
              checked={form.is_active}
              onCheckedChange={(checked) => onChange({ ...form, is_active: checked })}
            />
          </div>
        </FormSection>

        {inlineError && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {inlineError}
          </p>
        )}
      </div>

      {/* Extra bottom padding keeps the sticky tray footer clear of the iOS home indicator and software keyboard scroll area. */}
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/50 bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur sm:px-6 sm:pb-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:justify-end">
          <Button
            variant="ghost"
            className="h-12 rounded-xl px-4 sm:h-10"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className={cn(
              "h-12 rounded-xl text-base font-semibold sm:h-10 sm:text-sm",
              !canSubmit && "bg-muted text-muted-foreground shadow-none hover:bg-muted hover:text-muted-foreground"
            )}
            onClick={handleSubmit}
            disabled={isMutating || !canSave}
            aria-disabled={!canSubmit}
          >
            {isMutating ? "Saving..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  )
}
