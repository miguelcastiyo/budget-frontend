"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, CalendarIcon, MoreHorizontal, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Calendar as AppCalendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import { getCurrentMonthKey } from "@/lib/date-filters"
import { asNumber, toDecimalString } from "@/lib/income-breakdown"
import type {
  Category,
  RecurringBillingType,
  RecurringExpense,
  RecurringExpensesResponse,
  Tag,
  Card as CardType,
} from "@/lib/api/types"
import { formatCurrency } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
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
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatAddedMonth(month: string): string {
  const parsed = parseMonthValue(month)
  return parsed ? format(parsed, "MMMM yyyy") : month
}

function formatBillingSchedule(item: RecurringExpense): string {
  if (item.billing_type === "last_day") {
    return "Last day monthly"
  }

  return `Day ${item.billing_day} monthly`
}

function parseMonthValue(month: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null
  }

  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const parsed = new Date(year, monthIndex, 1)

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex
  ) {
    return null
  }

  return parsed
}

function toMonthValue(value: Date): string {
  return format(value, "yyyy-MM")
}

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
  const selectedMonth = parseMonthValue(value)
  const displayLabel = selectedMonth ? format(selectedMonth, "MMMM yyyy") : placeholder

  return (
    <div className="space-y-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
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
        <PopoverContent className="w-auto p-0" align="end" avoidCollisions>
          <AppCalendar
            mode="single"
            selected={selectedMonth ?? undefined}
            onSelect={(next) => {
              if (!next) {
                return
              }
              onChange(toMonthValue(next))
            }}
            defaultMonth={selectedMonth ?? new Date()}
            initialFocus
          />
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
  const [month, setMonth] = useState(getCurrentMonthKey())
  const [data, setData] = useState<RecurringExpensesResponse | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<CardType[]>([])

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<RecurringFormState>(() => emptyForm(getCurrentMonthKey()))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<RecurringFormState | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const newRecurringScrollRef = useRef<HTMLDivElement>(null)
  const editRecurringScrollRef = useRef<HTMLDivElement>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editingItem = data?.items.find((item) => item.id === editingId) ?? null
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
  const closeNewRecurringDialog = () => {
    setShowNew(false)
    setNewForm(emptyForm(month, tagOptions[0]?.id ?? ""))
  }
  const closeEditRecurringDialog = () => {
    setEditingId(null)
    setEditingForm(null)
  }
  const newRecurringSwipeDismiss = useSwipeDismiss({
    open: showNew,
    onDismiss: closeNewRecurringDialog,
    scrollRef: newRecurringScrollRef,
  })
  const editRecurringSwipeDismiss = useSwipeDismiss({
    open: editingId !== null && editingForm !== null,
    onDismiss: closeEditRecurringDialog,
    scrollRef: editRecurringScrollRef,
  })

  const handleCreate = async () => {
    if (!newForm.expense.trim() || !newForm.tag_id || !isValidRecurringAmount(newForm.amount) || !isValidBillingDay(newForm)) {
      setError("Add an expense name, amount, tag, and valid billing day")
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
            className="h-9 rounded-full px-3 lg:size-9 lg:px-0"
            aria-label="Add recurring expense"
            onClick={() => setShowNew(true)}
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm lg:sr-only">Add</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-3 lg:max-w-6xl lg:px-8 lg:pt-8">
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
              <div className="mt-3 flex items-end justify-between gap-4 sm:mt-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Committed total</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{formatCurrency(data?.committed_total ?? "0.00")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">Recurring items</p>
                  <p className="mt-1 text-xl font-semibold">{data?.items_count ?? 0}</p>
                </div>
              </div>
            </Card>

            <Button className="h-10 w-full rounded-xl lg:hidden" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              Add recurring expense
            </Button>

            <Card className="overflow-hidden border-0 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5 sm:px-5 sm:py-3">
                <div>
                  <h2 className="text-sm font-semibold">Recurring items</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatAddedMonth(month)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{activeItemsCount} Active</p>
                  {inactiveItemsCount > 0 && <p>{inactiveItemsCount} Inactive</p>}
                </div>
              </div>

              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <div className="p-4 text-sm text-muted-foreground sm:p-5">
                  No recurring expenses yet.
                </div>
              )}

              <div className="divide-y divide-border/60">
                {data?.items.map((item) => {
                  const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      className="group flex cursor-pointer gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-5 sm:py-3"
                      aria-label={`Edit ${item.expense}`}
                      onClick={() => startEdit(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          startEdit(item)
                        }
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary sm:h-9 sm:w-9">
                        <TagIcon className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.expense}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.tag.name}
                              {item.card ? ` · ${item.card.name}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.is_active ? "Active" : "Inactive"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-start justify-between gap-3">
                          <div className="min-w-0 text-xs text-muted-foreground">
                            <p className="truncate">
                              {formatBillingSchedule(item)} · Next: {formatProjectedDate(item.projected_date_for_month)}
                            </p>
                          </div>
                          <div
                            // Keep secondary actions from also triggering the row's edit shortcut.
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="-mr-1 -mt-1 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                                  aria-label={`Actions for ${item.expense}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onClick={() => startEdit(item)}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteId(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
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

      <Dialog
        open={showNew}
        onOpenChange={(open) => {
          if (open) {
            setShowNew(true)
          } else {
            closeNewRecurringDialog()
          }
        }}
      >
        <DialogContent
          {...newRecurringSwipeDismiss}
          className={cn(
            "flex max-h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] w-full grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border",
            mobileDrawerDialogClassName
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-4 pt-3 text-left sm:px-6 sm:pt-5">
            <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-2 sm:hidden")} aria-hidden="true" />
            <DialogTitle className="text-xl font-semibold">New Recurring Expense</DialogTitle>
            <DialogDescription>
              Add a monthly bill to include it in your budget upfront.
            </DialogDescription>
          </DialogHeader>
          <div ref={newRecurringScrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <RecurringForm
              form={newForm}
              tags={tagOptions}
              cards={cards}
              isMutating={isMutating}
              saveLabel="Create recurring expense"
              onChange={setNewForm}
              onCancel={closeNewRecurringDialog}
              onSave={() => void handleCreate()}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingId !== null && editingForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditRecurringDialog()
          }
        }}
      >
        <DialogContent
          {...editRecurringSwipeDismiss}
          className={cn(
            "flex max-h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] w-full grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border",
            mobileDrawerDialogClassName
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-4 pt-3 text-left sm:px-6 sm:pt-5">
            <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-2 sm:hidden")} aria-hidden="true" />
            <DialogTitle className="text-xl font-semibold">Edit Recurring Expense</DialogTitle>
            <DialogDescription>
              Update the monthly rule for future budget planning.
            </DialogDescription>
          </DialogHeader>
          <div ref={editRecurringScrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {editingForm && (
              <RecurringForm
                form={editingForm}
                tags={tagOptions}
                cards={cards}
                isMutating={isMutating}
                canSave={hasEditingChanges}
                saveLabel="Save changes"
                onChange={setEditingForm}
                onCancel={closeEditRecurringDialog}
                onSave={() => void handleSaveEdit()}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recurring expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops future automatic monthly entries. Existing transactions stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isMutating}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  onCancel: () => void
  onSave: () => void
}

function RecurringForm({
  form,
  tags,
  cards,
  isMutating,
  canSave = true,
  saveLabel,
  onChange,
  onCancel,
  onSave,
}: RecurringFormProps) {
  const [touched, setTouched] = useState({
    amount: false,
    expense: false,
    billing_day: false,
  })
  const hasAmount = form.amount.trim() !== ""
  const hasExpense = form.expense.trim() !== ""
  const amountIsValid = isValidRecurringAmount(form.amount)
  const billingDayIsValid = isValidBillingDay(form)
  const canSubmit = Boolean(canSave && hasExpense && form.tag_id && amountIsValid && billingDayIsValid)
  const disabledReason = !hasExpense
    ? "Expense name is required."
    : !amountIsValid
      ? "Amount must be greater than $0."
      : !billingDayIsValid
        ? "Billing day must be 1-31."
        : !canSave
          ? "Make a change to save."
          : null

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-5 pb-28 pt-4 sm:px-6 sm:pb-24 sm:pt-5">
        <FormSection title="Expense">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Amount</Label>
              <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 px-3">
                <span className="text-lg text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => onChange({ ...form, amount: e.target.value })}
                  onBlur={() => setTouched((previous) => ({ ...previous, amount: true }))}
                  placeholder="0.00"
                  aria-invalid={touched.amount && !amountIsValid}
                  className="h-12 border-0 bg-transparent px-2 text-lg font-semibold focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              {(touched.amount || (hasAmount && !amountIsValid)) && !amountIsValid && (
                <p className="text-xs text-destructive">Amount must be greater than $0.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Expense name</Label>
              <Input
                value={form.expense}
                onChange={(e) => onChange({ ...form, expense: e.target.value })}
                onBlur={() => setTouched((previous) => ({ ...previous, expense: true }))}
                placeholder="Rent"
                aria-invalid={touched.expense && !hasExpense}
                className="h-12 rounded-xl sm:h-10"
              />
              {touched.expense && !hasExpense && (
                <p className="text-xs text-destructive">Expense name is required.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => onChange({ ...form, category: value as Category })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="needs">Needs</SelectItem>
                  <SelectItem value="wants">Wants</SelectItem>
                  <SelectItem value="savings_debts">Savings & Debts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tag</Label>
              <Select
                value={form.tag_id}
                onValueChange={(value) => onChange({ ...form, tag_id: value })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Card</Label>
            <Select
              value={form.card_id || "__none"}
              onValueChange={(value) => onChange({ ...form, card_id: value === "__none" ? "" : value })}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No card</SelectItem>
                {cards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>

        <FormSection title="Schedule">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Billing rule</Label>
              <Select
                value={form.billing_type}
                onValueChange={(value) => onChange({ ...form, billing_type: value as RecurringBillingType })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day_of_month">Specific day</SelectItem>
                  <SelectItem value="last_day">Last day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
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
                aria-invalid={touched.billing_day && !billingDayIsValid}
                className="h-10 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {(touched.billing_day || !billingDayIsValid) && !billingDayIsValid && (
                <p className="text-xs text-destructive">Billing day must be 1-31.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Starts month</Label>
              <MonthPicker
                value={form.starts_month}
                onChange={(value) => onChange({ ...form, starts_month: value })}
                placeholder="Select month"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Ends month</Label>
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
              <p className="mt-0.5 text-xs text-muted-foreground">Include this monthly rule in future planning.</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => onChange({ ...form, is_active: checked })}
            />
          </div>
        </FormSection>
      </div>

      {/* Extra bottom padding keeps the sticky tray footer clear of the iOS home indicator and software keyboard scroll area. */}
      <div className="sticky bottom-0 shrink-0 border-t border-border/50 bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur sm:px-6 sm:pb-4">
        {disabledReason && (
          <p className="mb-2 text-right text-xs text-muted-foreground">{disabledReason}</p>
        )}
        <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          className="rounded-xl"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          className="rounded-xl disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          onClick={onSave}
          disabled={isMutating || !canSubmit}
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
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
