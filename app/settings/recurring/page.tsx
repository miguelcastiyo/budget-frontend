"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, CalendarIcon, Pencil, Plus, Trash2 } from "lucide-react"
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

function formatProjectedDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }
  return parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
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
        <PopoverContent className="w-auto p-0" align="end">
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

  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleCreate = async () => {
    if (!newForm.expense.trim() || !newForm.tag_id) {
      setError("Expense name and tag are required")
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
    if (!editingId || !editingForm || !editingForm.expense.trim() || !editingForm.tag_id) {
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

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1">Recurring</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setShowNew(true)}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Recurring expenses are auto-added once per month so your dashboard includes committed spend early.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card className="p-4 border-0 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="recurring-month" className="text-sm font-medium">Month</Label>
            <MonthPicker
              id="recurring-month"
              value={month}
              onChange={setMonth}
              placeholder="Select month"
              className="w-[180px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Committed Total</p>
              <p className="text-2xl font-semibold">{formatCurrency(data?.committed_total ?? "0.00")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Rules</p>
              <p className="text-lg font-semibold">{data?.items_count ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm divide-y divide-border">
          {!isLoading && (data?.items.length ?? 0) === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No recurring expenses yet.</div>
          )}

          {data?.items.map((item) => {
            const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)

            return (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <TagIcon className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.expense}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.tag.name}
                      {item.card ? ` · ${item.card.name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.billing_type === "last_day"
                        ? "Bills on the last day of the month"
                        : `Bills on day ${item.billing_day} of each month`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Next in {month}: {formatProjectedDate(item.projected_date_for_month)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.is_active ? "Active" : "Paused"}
                    </p>
                    {item.generated_for_month && (
                      <p className="text-[11px] text-green-600">Added for {month}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => {
                      setEditingId(item.id)
                      setEditingForm(formFromItem(item))
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </Card>
      </main>

      <Dialog
        open={showNew}
        onOpenChange={(open) => {
          setShowNew(open)
          if (!open) {
            setNewForm(emptyForm(month, tagOptions[0]?.id ?? ""))
          }
        }}
      >
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4 border-b border-border/50">
            <DialogTitle className="text-xl font-semibold">New Recurring Expense</DialogTitle>
            <DialogDescription>
              Add a monthly expense that gets pre-added at the start of each month.
            </DialogDescription>
          </DialogHeader>
          <RecurringForm
            form={newForm}
            tags={tagOptions}
            cards={cards}
            isMutating={isMutating}
            saveLabel="Create recurring expense"
            onChange={setNewForm}
            onCancel={() => {
              setShowNew(false)
              setNewForm(emptyForm(month, tagOptions[0]?.id ?? ""))
            }}
            onSave={() => void handleCreate()}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingId !== null && editingForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null)
            setEditingForm(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4 border-b border-border/50">
            <DialogTitle className="text-xl font-semibold">Edit Recurring Expense</DialogTitle>
            <DialogDescription>
              Update future monthly instances for this recurring expense.
            </DialogDescription>
          </DialogHeader>
          {editingForm && (
            <RecurringForm
              form={editingForm}
              tags={tagOptions}
              cards={cards}
              isMutating={isMutating}
              saveLabel="Save changes"
              onChange={setEditingForm}
              onCancel={() => {
                setEditingId(null)
                setEditingForm(null)
              }}
              onSave={() => void handleSaveEdit()}
            />
          )}
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
  saveLabel,
  onChange,
  onCancel,
  onSave,
}: RecurringFormProps) {
  return (
    <div className="p-6 space-y-5">
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
            placeholder="0.00"
            className="h-12 border-0 bg-transparent px-2 text-lg font-semibold focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Expense</Label>
        <Input
          value={form.expense}
          onChange={(e) => onChange({ ...form, expense: e.target.value })}
          placeholder="Rent"
          className="h-10 rounded-xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <Label className="text-sm">Card (optional)</Label>
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
            disabled={form.billing_type === "last_day"}
            placeholder={form.billing_type === "last_day" ? "Auto" : "1-31"}
            className="h-10 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          <Label className="text-sm">Ends month (optional)</Label>
          <MonthPicker
            value={form.ends_month}
            onChange={(value) => onChange({ ...form, ends_month: value })}
            placeholder="No end month"
            className="w-full"
            allowClear
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Label className="text-sm">Active</Label>
        <Switch
          checked={form.is_active}
          onCheckedChange={(checked) => onChange({ ...form, is_active: checked })}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
        <Button
          variant="ghost"
          className="rounded-xl"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          className="rounded-xl"
          onClick={onSave}
          disabled={isMutating || !form.expense.trim() || !form.tag_id}
        >
          {isMutating ? "Saving..." : saveLabel}
        </Button>
      </div>
    </div>
  )
}
