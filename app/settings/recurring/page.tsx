"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, CalendarIcon, CreditCard, MoreHorizontal, Pencil, Plus, Repeat, Trash2, X } from "lucide-react"
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
import { getTagIcon, TAG_ICON_OPTIONS } from "@/lib/tag-icons"
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

const MAX_TAG_CHIP_LABEL_LENGTH = 11
const TAG_CHIP_LABEL_OVERRIDES: Record<string, string> = {
  subscriptions: "Subs",
  subscription: "Subs",
  transportation: "Transit",
}

const categoryConfig = {
  needs: { label: "Needs", selectedClassName: "bg-needs/15" },
  wants: { label: "Wants", selectedClassName: "bg-wants/15" },
  savings: { label: "Savings", selectedClassName: "bg-savings/15" },
} as const

function compactTagLabel(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ")
  const override = TAG_CHIP_LABEL_OVERRIDES[normalized.toLocaleLowerCase()]
  if (override) {
    return override
  }

  if (normalized.length <= MAX_TAG_CHIP_LABEL_LENGTH) {
    return normalized
  }

  const firstWord = normalized.split(" ")[0] || normalized
  return firstWord.length <= MAX_TAG_CHIP_LABEL_LENGTH ? firstWord : firstWord.slice(0, MAX_TAG_CHIP_LABEL_LENGTH)
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
          <DialogHeader className="relative z-10 shrink-0 border-b border-border/50 bg-background/95 px-5 pb-3 pt-2 text-left backdrop-blur sm:px-6 sm:pb-4 sm:pt-5">
            <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-2 sm:hidden")} aria-hidden="true" />
            <DialogTitle className="text-xl font-semibold">New Recurring Bill</DialogTitle>
            <DialogDescription>
              Add a monthly bill so it counts toward your budget upfront.
            </DialogDescription>
          </DialogHeader>
          <div ref={newRecurringScrollRef} className="min-h-0 flex-1 scroll-pt-4 overflow-y-auto">
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
          <DialogHeader className="relative z-10 shrink-0 border-b border-border/50 bg-background/95 px-5 pb-3 pt-2 text-left backdrop-blur sm:px-6 sm:pb-4 sm:pt-5">
            <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-2 sm:hidden")} aria-hidden="true" />
            <DialogTitle className="text-xl font-semibold">Edit Recurring Bill</DialogTitle>
            <DialogDescription>
              Update the monthly rule for future budget planning.
            </DialogDescription>
          </DialogHeader>
          <div ref={editRecurringScrollRef} className="min-h-0 flex-1 scroll-pt-4 overflow-y-auto">
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
  onCreateTag: (name: string, iconKey: string) => Promise<Tag>
  onCreateCard: (name: string) => Promise<CardType>
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
  const hasAmount = form.amount.trim() !== ""
  const hasExpense = form.expense.trim() !== ""
  const amountIsValid = isValidRecurringAmount(form.amount)
  const billingDayIsValid = isValidBillingDay(form)
  const canSubmit = Boolean(canSave && hasExpense && form.tag_id && amountIsValid && billingDayIsValid)
  const displayAmount = form.amount || "00.00"
  const amountLength = displayAmount.length
  const amountInputStyle = {
    width: `${Math.min(Math.max(amountLength + 0.25, 5), 10.5)}ch`,
  } satisfies CSSProperties
  const amountTextClassName = amountLength > 7
    ? "text-4xl sm:text-3xl"
    : "text-5xl sm:text-4xl"
  const tagChipRailStyle = {
    gridAutoColumns: "clamp(6.75rem, calc((100% - 1.5rem) / 3.35), 8.75rem)",
  } satisfies CSSProperties
  const amountErrorId = "recurring-amount-error"
  const descriptionErrorId = "recurring-description-error"
  const billingDayErrorId = "recurring-billing-day-error"
  const showAmountError = (submitAttempted || touched.amount) && !amountIsValid
  const showDescriptionError = (submitAttempted || touched.expense) && !hasExpense
  const showBillingDayError = (submitAttempted || touched.billing_day) && !billingDayIsValid
  const selectedNewTagIconOption = TAG_ICON_OPTIONS.find((option) => option.key === newTagIconKey)
  const AutoNewTagIcon = getTagIcon(newTagName || "Tag", null)
  const NewTagPreviewIcon = selectedNewTagIconOption?.icon ?? AutoNewTagIcon
  const newTagIconLabel = selectedNewTagIconOption?.label ?? "Auto"

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
      <div className="flex-1 space-y-4 px-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-28 sm:pt-4">
        <FormSection title="Expense">
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-4 sm:py-4">
            <label htmlFor="recurring-amount" className="block text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Amount
            </label>
            <div className="mt-2.5 flex justify-center">
              <div className="inline-flex items-baseline gap-2">
                <span className={cn("font-semibold leading-none text-muted-foreground", amountTextClassName)}>
                  $
                </span>
                <Input
                  id="recurring-amount"
                  name="recurring_amount"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={form.amount}
                  style={amountInputStyle}
                  onChange={(e) => {
                    setSubmitAttempted(false)
                    onChange({ ...form, amount: e.target.value })
                  }}
                  onBlur={() => setTouched((previous) => ({ ...previous, amount: true }))}
                  placeholder="00.00"
                  aria-invalid={showAmountError}
                  aria-describedby={showAmountError ? amountErrorId : undefined}
                  className={cn(
                    "h-auto min-w-0 max-w-[68vw] border-0 bg-transparent p-0 text-left font-semibold leading-none tracking-normal shadow-none placeholder:text-muted-foreground/30 focus-visible:ring-0 dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                    amountTextClassName
                  )}
                />
              </div>
            </div>
            {showAmountError && (
              <p id={amountErrorId} className="mt-2.5 text-center text-xs text-destructive">Amount must be greater than $0.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-description" className="text-sm font-medium">Description</Label>
            <div className="relative">
              <Input
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
              <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center justify-between gap-3 pb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Create tag</p>
                    <p className="truncate text-xs text-muted-foreground">It will be selected for this recurring expense.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowNewTag(false)
                      setNewTagName("")
                      setNewTagIconKey("")
                    }}
                    className="h-9 w-9 shrink-0 rounded-lg p-0"
                    aria-label="Cancel new tag"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid min-w-0 gap-3">
                  <div className="relative min-w-0">
                    <NewTagPreviewIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="h-11 rounded-xl border-border/60 pl-10 sm:h-10"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void handleCreateInlineTag()
                        }
                      }}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs font-medium text-muted-foreground">Icon</Label>
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <NewTagPreviewIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{newTagIconLabel}</span>
                      </span>
                    </div>
                    <div className="relative min-w-0 max-w-full overflow-hidden">
                      <div className="flex max-w-full gap-2 overflow-x-auto scroll-smooth pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                          type="button"
                          aria-pressed={!newTagIconKey}
                          aria-label="Use automatic icon"
                          title="Auto icon"
                          onClick={() => setNewTagIconKey("")}
                          className={cn(
                            "inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                            !newTagIconKey
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )}
                        >
                          <AutoNewTagIcon className="h-4 w-4 shrink-0" />
                          Auto
                        </button>
                        {TAG_ICON_OPTIONS.map((option) => {
                          const Icon = option.icon
                          const isSelected = newTagIconKey === option.key

                          return (
                            <button
                              key={option.key}
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={`Use ${option.label} icon`}
                              title={option.label}
                              onClick={() => setNewTagIconKey(option.key)}
                              className={cn(
                                "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          )
                        })}
                      </div>
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/80 to-transparent" aria-hidden="true" />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleCreateInlineTag()}
                    disabled={!newTagName.trim() || isCreatingTag}
                    className="h-11 w-full rounded-xl px-4 sm:h-10"
                  >
                    {isCreatingTag ? "Adding..." : "Add tag"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                {tags.length > 0 ? (
                  <div className="relative min-w-0 overflow-hidden">
                    <div
                      className="grid min-w-0 grid-flow-col gap-2 overflow-x-auto scroll-smooth pb-0.5 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      style={tagChipRailStyle}
                    >
                      {tags.map((tag) => {
                        const isSelected = form.tag_id === tag.id
                        const TagIcon = getTagIcon(tag.name, tag.icon_key)
                        const label = compactTagLabel(tag.name)

                        return (
                          <button
                            key={tag.id}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={tag.name}
                            title={tag.name}
                            onClick={() => onChange({ ...form, tag_id: tag.id })}
                            className={cn(
                              "inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                          >
                            <TagIcon className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 truncate">{label}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent" aria-hidden="true" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                    Create a tag to use it for this recurring expense.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Category</Label>
            <div className="grid grid-cols-3 gap-2">
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

          <div className="space-y-2">
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
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center justify-between gap-3 pb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Create card</p>
                    <p className="truncate text-xs text-muted-foreground">It will be selected for this recurring expense.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowNewCard(false)
                      setNewCardName("")
                    }}
                    className="h-9 w-9 shrink-0 rounded-lg p-0"
                    aria-label="Cancel new card"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative min-w-0">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Card name"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      className="h-11 rounded-xl border-border/60 pl-10 sm:h-10"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void handleCreateInlineCard()
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleCreateInlineCard()}
                    disabled={!newCardName.trim() || isCreatingCard}
                    className="h-11 rounded-xl px-4 sm:h-10"
                  >
                    {isCreatingCard ? "Adding..." : "Add card"}
                  </Button>
                </div>
              </div>
            ) : (
              <Select
                value={form.card_id || "__none"}
                onValueChange={(value) => onChange({ ...form, card_id: value === "__none" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-xl border-border/60">
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
            )}
          </div>
        </FormSection>

        <FormSection title="Schedule" description="Choose when this bill should be added each month.">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Starts</Label>
              <MonthPicker
                value={form.starts_month}
                onChange={(value) => onChange({ ...form, starts_month: value })}
                placeholder="Select month"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
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
