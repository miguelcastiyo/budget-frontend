"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  Category,
  RecurringBillingType,
  Tag,
  Card as CardType,
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from "@/lib/api/types"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, Plus, X, CreditCard, TagIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ApiError, apiClient } from "@/lib/api/client"

interface AddTransactionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTransactionCreated?: () => void
  onTransactionUpdated?: (transaction: Transaction) => void
  mode?: "create" | "edit"
  transaction?: Transaction | null
}

export function AddTransactionSheet({
  open,
  onOpenChange,
  onTransactionCreated,
  onTransactionUpdated,
  mode = "create",
  transaction = null,
}: AddTransactionSheetProps) {
  const [date, setDate] = useState<Date>(new Date())
  const [expense, setExpense] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<Category>("needs")
  const [isSplit, setIsSplit] = useState(false)
  const [tagId, setTagId] = useState("")
  const [cardId, setCardId] = useState("")
  const [makeRecurring, setMakeRecurring] = useState(false)
  const [recurringBillingType, setRecurringBillingType] = useState<RecurringBillingType>("day_of_month")
  const [recurringBillingDay, setRecurringBillingDay] = useState("1")

  const [tags, setTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<CardType[]>([])

  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [showNewCard, setShowNewCard] = useState(false)
  const [newCardName, setNewCardName] = useState("")

  const [isLoadingTaxonomy, setIsLoadingTaxonomy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [isCreatingCard, setIsCreatingCard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = mode === "edit" && transaction !== null

  const parseTransactionDate = (dateStr: string): Date => {
    const isoDateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoDateMatch) {
      return new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    }

    const parsed = new Date(dateStr)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }

  const isLastDayOfMonth = (value: Date): boolean => {
    const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
    return value.getDate() === lastDay
  }

  const applyRecurringDefaultsFromDate = (selectedDate: Date) => {
    setRecurringBillingDay(String(selectedDate.getDate()))
    setRecurringBillingType(isLastDayOfMonth(selectedDate) ? "last_day" : "day_of_month")
  }

  const loadTaxonomy = useCallback(async () => {
    setIsLoadingTaxonomy(true)
    setError(null)

    try {
      const [tagsResponse, cardsResponse] = await Promise.all([
        apiClient.getTags(),
        apiClient.getCards(),
      ])

      setTags(tagsResponse.items)
      setCards(cardsResponse.items)

      setTagId((previous) => previous || tagsResponse.items[0]?.id || "")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load tags and cards")
      }
    } finally {
      setIsLoadingTaxonomy(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadTaxonomy()
    if (isEditMode && transaction) {
      setDate(parseTransactionDate(transaction.date))
      setExpense(transaction.expense)
      setAmount(transaction.amount)
      setCategory(transaction.category)
      setIsSplit(transaction.is_split)
      setTagId(transaction.tag.id)
      setCardId(transaction.card?.id ?? "")
      setShowNewTag(false)
      setNewTagName("")
      setShowNewCard(false)
      setNewCardName("")
      setMakeRecurring(false)
      setRecurringBillingType("day_of_month")
      setRecurringBillingDay(String(parseTransactionDate(transaction.date).getDate()))
      setError(null)
      return
    }

    resetForm()
  }, [isEditMode, loadTaxonomy, open, transaction])

  const resetForm = () => {
    const now = new Date()
    setExpense("")
    setAmount("")
    setCategory("needs")
    setIsSplit(false)
    setTagId("")
    setCardId("")
    setDate(now)
    setShowNewTag(false)
    setNewTagName("")
    setShowNewCard(false)
    setNewCardName("")
    setMakeRecurring(false)
    applyRecurringDefaultsFromDate(now)
    setError(null)
  }

  const handleCreateTag = async () => {
    const name = newTagName.trim()
    if (!name) return

    setIsCreatingTag(true)
    setError(null)

    try {
      const created = await apiClient.createTag({ name })
      setTags((prev) => [...prev, created])
      setTagId(created.id)
      setNewTagName("")
      setShowNewTag(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to create tag")
      }
    } finally {
      setIsCreatingTag(false)
    }
  }

  const handleCreateCard = async () => {
    const name = newCardName.trim()
    if (!name) return

    setIsCreatingCard(true)
    setError(null)

    try {
      const created = await apiClient.createCard({ name })
      setCards((prev) => [...prev, created])
      setCardId(created.id)
      setNewCardName("")
      setShowNewCard(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to create card")
      }
    } finally {
      setIsCreatingCard(false)
    }
  }

  const normalizeAmount = (value: string): string | null => {
    const parsed = Number.parseFloat(value.trim())
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null
    }
    return parsed.toFixed(2)
  }

  const sanitizeAmountInput = (value: string): string => {
    const normalized = value.replace(/,/g, ".").replace(/[^\d.]/g, "")
    const [whole = "", ...fractionParts] = normalized.split(".")
    const fraction = fractionParts.join("").slice(0, 2)

    if (normalized.startsWith(".")) {
      return fraction === "" ? "." : `.${fraction}`
    }

    if (fractionParts.length === 0) {
      return whole
    }

    return `${whole}.${fraction}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tagId) {
      setError("Please select a tag")
      return
    }

    const normalizedAmount = normalizeAmount(amount)
    if (!normalizedAmount) {
      setError("Please enter a valid amount")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const normalizedDate = format(date, "yyyy-MM-dd")

      if (isEditMode && transaction) {
        const payload: UpdateTransactionRequest = {
          date: normalizedDate,
          expense: expense.trim(),
          amount: normalizedAmount,
          category,
          is_split: isSplit,
          tag_id: tagId,
          card_id: cardId || undefined,
        }
        const updated = await apiClient.updateTransaction(transaction.id, payload)
        onTransactionUpdated?.(updated)
      } else {
        const payload: CreateTransactionRequest = {
          date: normalizedDate,
          expense: expense.trim(),
          amount: normalizedAmount,
          category,
          is_split: isSplit,
          tag_id: tagId,
        }

        if (cardId) {
          payload.card_id = cardId
        }

        const created = await apiClient.createTransaction(payload)

        if (makeRecurring) {
          const startsMonth = format(date, "yyyy-MM")
          const normalizedBillingDay = Math.min(Math.max(parseInt(recurringBillingDay || "1", 10), 1), 31)

          try {
            await apiClient.createRecurringExpense({
              expense: expense.trim(),
              amount: normalizedAmount,
              category,
              tag_id: tagId,
              card_id: cardId || null,
              billing_type: recurringBillingType,
              billing_day: recurringBillingType === "day_of_month" ? normalizedBillingDay : null,
              starts_month: startsMonth,
              is_active: true,
              seed_transaction_id: created.id,
            })
          } catch (recurringError) {
            try {
              await apiClient.deleteTransaction(created.id)
            } catch {
              // Best-effort rollback; primary error below.
            }
            throw recurringError
          }
        }

        onTransactionCreated?.()
        resetForm()
      }

      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError(isEditMode ? "Unable to update transaction" : "Unable to create transaction")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const categoryConfig = {
    needs: { label: "Needs", color: "bg-needs" },
    wants: { label: "Wants", color: "bg-wants" },
    savings_debts: { label: "Savings", color: "bg-savings" },
  } as const
  const recurringDayNumber = parseInt(recurringBillingDay || "0", 10)
  const hasValidRecurringConfig =
    !makeRecurring ||
    recurringBillingType === "last_day" ||
    (Number.isInteger(recurringDayNumber) && recurringDayNumber >= 1 && recurringDayNumber <= 31)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(calc(100dvw-1rem),32rem)] max-w-[min(calc(100dvw-1rem),32rem)] p-0 gap-0 overflow-x-hidden overflow-y-auto rounded-2xl max-h-[min(90dvh,90vh)]">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-semibold">
            {isEditMode ? "Edit Transaction" : "New Transaction"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 py-12 bg-gradient-to-b from-muted/30 to-transparent">
            <div className="text-center">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Amount
              </label>
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-light text-muted-foreground">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="^\d*([.]\d{0,2})?$"
                  enterKeyHint="next"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                  className="text-6xl font-semibold tracking-tight border-0 bg-transparent p-0 h-auto w-auto min-w-[120px] max-w-[320px] text-center focus-visible:ring-0 placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ fontSize: "3.75rem" }}
                  required
                  autoFocus
                />
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="expense" className="text-sm font-medium">
                Description
              </Label>
              <Input
                id="expense"
                placeholder="What did you spend on?"
                value={expense}
                onChange={(e) => setExpense(e.target.value)}
                className="h-12 rounded-xl border-border/60 focus:border-foreground/20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-12 rounded-xl justify-start text-left font-normal border-border/60 hover:border-foreground/20",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {date ? format(date, "EEEE, MMMM d, yyyy") : "Pick a date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (!d) {
                        return
                      }
                      setDate(d)
                      if (makeRecurring) {
                        applyRecurringDefaultsFromDate(d)
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {!isEditMode && (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Make recurring</Label>
                    <p className="text-xs text-muted-foreground">
                      Adds this expense automatically each month.
                    </p>
                  </div>
                  <Switch
                    checked={makeRecurring}
                    onCheckedChange={(checked) => {
                      setMakeRecurring(checked)
                      if (checked) {
                        applyRecurringDefaultsFromDate(date)
                      }
                    }}
                  />
                </div>

                {makeRecurring && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Billing rule</Label>
                      <Select
                        value={recurringBillingType}
                        onValueChange={(value) => setRecurringBillingType(value as RecurringBillingType)}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day_of_month">Same day monthly</SelectItem>
                          <SelectItem value="last_day">Last day monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Billing day</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={recurringBillingType === "last_day" ? "" : recurringBillingDay}
                        onChange={(e) => setRecurringBillingDay(e.target.value)}
                        disabled={recurringBillingType === "last_day"}
                        placeholder={recurringBillingType === "last_day" ? "Auto" : "1-31"}
                        className="h-10 rounded-xl border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["needs", "wants", "savings_debts"] as const).map((cat) => {
                  const config = categoryConfig[cat]
                  const isSelected = category === cat

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "relative h-12 rounded-xl font-medium transition-all duration-200 text-sm",
                        isSelected
                          ? `${config.color} text-white shadow-sm`
                          : "bg-muted/50 text-foreground hover:bg-muted"
                      )}
                    >
                      {config.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={isSplit} onCheckedChange={(checked) => setIsSplit(Boolean(checked))} />
                <div>
                  <p className="text-sm font-medium">Split expense</p>
                  <p className="text-xs text-muted-foreground">Marks this transaction as your portion of a shared expense.</p>
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Tag</Label>
                {!showNewTag && (
                  <button
                    type="button"
                    onClick={() => setShowNewTag(true)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New tag
                  </button>
                )}
              </div>

              {showNewTag ? (
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="h-12 rounded-xl pl-10 border-border/60"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void handleCreateTag()
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleCreateTag()}
                    disabled={!newTagName.trim() || isCreatingTag}
                    className="h-12 px-4 rounded-xl shrink-0"
                  >
                    {isCreatingTag ? "Adding..." : "Add"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowNewTag(false)
                      setNewTagName("")
                    }}
                    className="h-12 w-12 rounded-xl p-0 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Select value={tagId} onValueChange={setTagId} required>
                  <SelectTrigger className="h-12 rounded-xl border-border/60">
                    <SelectValue placeholder={isLoadingTaxonomy ? "Loading tags..." : "Select a tag"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Card <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                {!showNewCard && (
                  <button
                    type="button"
                    onClick={() => setShowNewCard(true)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New card
                  </button>
                )}
              </div>

              {showNewCard ? (
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Card name"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      className="h-12 rounded-xl pl-10 border-border/60"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void handleCreateCard()
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleCreateCard()}
                    disabled={!newCardName.trim() || isCreatingCard}
                    className="h-12 px-4 rounded-xl shrink-0"
                  >
                    {isCreatingCard ? "Adding..." : "Add"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowNewCard(false)
                      setNewCardName("")
                    }}
                    className="h-12 w-12 rounded-xl p-0 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Select value={cardId || "none"} onValueChange={(value) => setCardId(value === "none" ? "" : value)}>
                  <SelectTrigger className="h-12 rounded-xl border-border/60">
                    <SelectValue placeholder={isLoadingTaxonomy ? "Loading cards..." : "Select a card"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No card</SelectItem>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">{error}</p>
            )}
          </div>

          <div className="p-6 pt-2 border-t border-border/50 bg-background">
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold"
              disabled={!amount || !expense || !tagId || isSubmitting || isLoadingTaxonomy || !hasValidRecurringConfig}
            >
              {isSubmitting ? (isEditMode ? "Saving..." : "Adding...") : (isEditMode ? "Save Changes" : "Add Transaction")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
