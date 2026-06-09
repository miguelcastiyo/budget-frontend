"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
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
  TransactionSuggestion,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from "@/lib/api/types"
import { Calendar } from "@/components/ui/calendar"
import { FormChipRail, type FormChipRailItem } from "@/components/budget/form-chip-rail"
import { TagIconPicker } from "@/components/settings/tag-icon-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, ChevronDown, Plus, X, CreditCard } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ApiError, apiClient } from "@/lib/api/client"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
import { getTagIcon } from "@/lib/tag-icons"

const MAX_AMOUNT_DIGITS = 9

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
  const [amountDigits, setAmountDigits] = useState("")
  const [category, setCategory] = useState<Category>("needs")
  const [isSplit, setIsSplit] = useState(false)
  const [tagId, setTagId] = useState("")
  const [cardId, setCardId] = useState("")
  const [makeRecurring, setMakeRecurring] = useState(false)
  const [recurringBillingType, setRecurringBillingType] = useState<RecurringBillingType>("day_of_month")
  const [recurringBillingDay, setRecurringBillingDay] = useState("1")

  const [tags, setTags] = useState<Tag[]>([])
  const [quickPickTags, setQuickPickTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<CardType[]>([])

  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagIconKey, setNewTagIconKey] = useState("")
  const [showNewCard, setShowNewCard] = useState(false)
  const [newCardName, setNewCardName] = useState("")
  const [showMoreDetails, setShowMoreDetails] = useState(false)

  const [isLoadingTaxonomy, setIsLoadingTaxonomy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<TransactionSuggestion[]>([])
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [isCreatingCard, setIsCreatingCard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = mode === "edit" && transaction !== null
  const transactionAlreadyRecurring = transaction?.recurring_expense_id != null
  const canCreateRecurringRule = !isEditMode || !transactionAlreadyRecurring
  const amountInputRef = useRef<HTMLInputElement>(null)
  const expenseInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const suggestionRequestRef = useRef(0)
  const appliedSuggestionExpenseRef = useRef<string | null>(null)
  const didAutoFocusOnOpenRef = useRef(false)

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

  const formatAmountDigits = (digits: string): string => {
    if (digits.length === 0) {
      return ""
    }

    const paddedDigits = digits.padStart(4, "0")

    return `${paddedDigits.slice(0, -2)}.${paddedDigits.slice(-2)}`
  }

  const amountDigitsFromDecimal = (value: string): string => {
    const normalized = value.trim().replace(/,/g, ".")
    if (normalized === "") {
      return ""
    }

    const [whole = "", fraction = ""] = normalized.split(".")
    const digits = `${whole.replace(/\D/g, "")}${fraction.replace(/\D/g, "").padEnd(2, "0").slice(0, 2)}`

    return digits.replace(/^0+/, "").slice(0, MAX_AMOUNT_DIGITS)
  }

  const setAmountFromDigits = (digits: string) => {
    const normalizedDigits = digits.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_AMOUNT_DIGITS)

    setAmountDigits(normalizedDigits)
    setAmount(formatAmountDigits(normalizedDigits))
  }

  const appendAmountDigits = (digits: string) => {
    if (!digits) {
      return
    }

    setAmountFromDigits(`${amountDigits}${digits}`)
  }

  const amountInputIsFullySelected = (): boolean => {
    const input = amountInputRef.current
    if (!input || amount.length === 0) {
      return false
    }

    return input.selectionStart === 0 && input.selectionEnd === amount.length
  }

  const focusAmountInput = () => {
    window.requestAnimationFrame(() => {
      amountInputRef.current?.focus()
    })
  }

  const focusExpenseInput = () => {
    window.requestAnimationFrame(() => {
      expenseInputRef.current?.focus()
    })
  }

  const loadTaxonomy = useCallback(async () => {
    setIsLoadingTaxonomy(true)
    setError(null)

    try {
      const [tagsResponse, cardsResponse, quickPickTagsResponse] = await Promise.all([
        apiClient.getTags(),
        apiClient.getCards(),
        apiClient.getTagQuickPicks(5).catch(() => ({ items: [] })),
      ])

      setTags(tagsResponse.items)
      setQuickPickTags(quickPickTagsResponse.items.length > 0 ? quickPickTagsResponse.items : tagsResponse.items.slice(0, 5))
      setCards(cardsResponse.items)
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
      const nextAmountDigits = amountDigitsFromDecimal(transaction.amount)
      setAmountDigits(nextAmountDigits)
      setAmount(formatAmountDigits(nextAmountDigits))
      setCategory(transaction.category)
      setIsSplit(transaction.is_split)
      setTagId(transaction.tag.id)
      setCardId(transaction.card?.id ?? "")
      setShowNewTag(false)
      setNewTagName("")
      setNewTagIconKey("")
      setShowNewCard(false)
      setNewCardName("")
      setShowMoreDetails(Boolean(transaction.card || transaction.is_split || transaction.recurring_expense_id != null))
      setMakeRecurring(false)
      setRecurringBillingType("day_of_month")
      setRecurringBillingDay(String(parseTransactionDate(transaction.date).getDate()))
      setSuggestions([])
      setError(null)
      return
    }

    resetForm()
  }, [isEditMode, loadTaxonomy, open, transaction])

  useEffect(() => {
    if (!open) {
      didAutoFocusOnOpenRef.current = false
      return
    }

    if (didAutoFocusOnOpenRef.current || isEditMode || showNewTag || showNewCard) {
      return
    }

    didAutoFocusOnOpenRef.current = true
    const timeoutId = window.setTimeout(() => {
      amountInputRef.current?.focus()
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [isEditMode, open, showNewCard, showNewTag])

  useEffect(() => {
    if (!open || isEditMode) {
      suggestionRequestRef.current += 1
      setSuggestions([])
      return
    }

    const query = expense.trim()
    if (query.length < 2) {
      suggestionRequestRef.current += 1
      setSuggestions([])
      return
    }

    const normalizedQuery = query.toLocaleLowerCase()
    if (appliedSuggestionExpenseRef.current && appliedSuggestionExpenseRef.current !== normalizedQuery) {
      appliedSuggestionExpenseRef.current = null
    }

    if (appliedSuggestionExpenseRef.current === normalizedQuery) {
      suggestionRequestRef.current += 1
      setSuggestions([])
      return
    }

    const requestId = suggestionRequestRef.current + 1
    suggestionRequestRef.current = requestId
    const timeoutId = window.setTimeout(() => {
      apiClient.getTransactionSuggestions(query, 5)
        .then((response) => {
          if (suggestionRequestRef.current === requestId) {
            setSuggestions(response.items)
          }
        })
        .catch(() => {
          if (suggestionRequestRef.current === requestId) {
            setSuggestions([])
          }
        })
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [expense, isEditMode, open])

  const resetForm = () => {
    const now = new Date()
    setExpense("")
    setAmount("")
    setAmountDigits("")
    setCategory("needs")
    setIsSplit(false)
    setTagId("")
    setCardId("")
    setDate(now)
    setShowNewTag(false)
    setNewTagName("")
    setNewTagIconKey("")
    setShowNewCard(false)
    setNewCardName("")
    setShowMoreDetails(false)
    setMakeRecurring(false)
    setSuggestions([])
    appliedSuggestionExpenseRef.current = null
    applyRecurringDefaultsFromDate(now)
    setError(null)
  }

  const updateTransactionDate = (nextDate: Date) => {
    setDate(nextDate)
    if (makeRecurring) {
      applyRecurringDefaultsFromDate(nextDate)
    }
  }

  const applySuggestion = (suggestion: TransactionSuggestion) => {
    const shouldFocusAmount = amount.trim().length === 0
    appliedSuggestionExpenseRef.current = suggestion.expense.trim().toLocaleLowerCase()
    setExpense(suggestion.expense)
    setTagId(suggestion.tag.id)
    setCategory(suggestion.category)
    setCardId(suggestion.card?.id ?? "")
    setIsSplit(suggestion.is_split)
    setShowMoreDetails(false)
    setSuggestions([])
    if (shouldFocusAmount) {
      focusAmountInput()
    }
  }

  const handleCreateTag = async () => {
    const name = newTagName.trim()
    if (!name) return

    setIsCreatingTag(true)
    setError(null)

    try {
      const created = await apiClient.createTag({
        name,
        icon_key: newTagIconKey || null,
      })
      setTags((prev) => [...prev, created])
      setQuickPickTags((prev) => [created, ...prev.filter((tag) => tag.id !== created.id)].slice(0, 5))
      setTagId(created.id)
      setNewTagName("")
      setNewTagIconKey("")
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

  const normalizedDate = format(date, "yyyy-MM-dd")
  const normalizedExpense = expense.trim()
  const normalizedAmount = normalizeAmount(amount)
  const normalizedTransactionPayload = {
    date: normalizedDate,
    expense: normalizedExpense,
    amount: normalizedAmount,
    category,
    is_split: isSplit,
    tag_id: tagId,
    card_id: cardId || undefined,
  }
  const baselineTransactionPayload = isEditMode && transaction
    ? {
      date: format(parseTransactionDate(transaction.date), "yyyy-MM-dd"),
      expense: transaction.expense.trim(),
      amount: Number.parseFloat(transaction.amount).toFixed(2),
      category: transaction.category,
      is_split: transaction.is_split,
      tag_id: transaction.tag.id,
      card_id: transaction.card?.id || undefined,
    }
    : null
  const hasEditChanges = !isEditMode || !baselineTransactionPayload
    ? true
    : JSON.stringify(normalizedTransactionPayload) !== JSON.stringify(baselineTransactionPayload) || (makeRecurring && !transactionAlreadyRecurring)

  const handleAmountBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent
    const inputType = nativeEvent.inputType
    const data = nativeEvent.data ?? ""

    if (inputType === "insertText") {
      event.preventDefault()
      if (/^\d+$/.test(data)) {
        appendAmountDigits(data)
      }
      return
    }

    if (inputType === "deleteContentBackward") {
      event.preventDefault()
      setAmountFromDigits(amountInputIsFullySelected() ? "" : amountDigits.slice(0, -1))
      return
    }

    if (inputType === "deleteContentForward") {
      event.preventDefault()
      if (amountInputIsFullySelected()) {
        setAmountFromDigits("")
      }
    }
  }

  const handleAmountKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      focusExpenseInput()
      return
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault()
      appendAmountDigits(event.key)
      return
    }

    if (event.key === "Backspace") {
      event.preventDefault()
      setAmountFromDigits(amountInputIsFullySelected() ? "" : amountDigits.slice(0, -1))
      return
    }

    if (event.key === "Delete") {
      if (amountInputIsFullySelected()) {
        event.preventDefault()
        setAmountFromDigits("")
      }
      return
    }

    if (["Tab", "Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    event.preventDefault()
  }

  const handleAmountPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()

    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "")
    if (!pastedDigits) {
      return
    }

    setAmountFromDigits(amountInputIsFullySelected() ? pastedDigits : `${amountDigits}${pastedDigits}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tagId) {
      setError("Please select a tag")
      return
    }

    if (!normalizedAmount) {
      setError("Please enter a valid amount")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
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

        if (makeRecurring && !transactionAlreadyRecurring) {
          const startsMonth = format(date, "yyyy-MM")
          const normalizedBillingDay = Math.min(Math.max(parseInt(recurringBillingDay || "1", 10), 1), 31)

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
            seed_transaction_id: updated.id,
          })
        }

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
    needs: { label: "Needs", selectedClassName: "bg-needs/15" },
    wants: { label: "Wants", selectedClassName: "bg-wants/15" },
    savings: { label: "Savings", selectedClassName: "bg-savings/15" },
  } as const
  const primarySuggestion = !isEditMode ? suggestions[0] : undefined
  const primarySuggestionParts = primarySuggestion
    ? [
      primarySuggestion.tag.name,
      categoryConfig[primarySuggestion.category].label,
      primarySuggestion.card?.name,
      primarySuggestion.is_split ? "Split" : null,
    ].filter(Boolean)
    : []
  const primarySuggestionSetup = primarySuggestionParts.join(" · ")
  const primarySuggestionIsPrefixMatch =
    primarySuggestion &&
    expense.length > 0 &&
    primarySuggestion.expense.toLocaleLowerCase().startsWith(expense.toLocaleLowerCase())
  const primarySuggestionCompletesDescription =
    primarySuggestion &&
    expense.trim().length > 0 &&
    primarySuggestion.expense.trim().toLocaleLowerCase() !== expense.trim().toLocaleLowerCase()
  const primarySuggestionShowsCompletion =
    primarySuggestionCompletesDescription && !primarySuggestionIsPrefixMatch
  const primarySuggestionLabel = primarySuggestionShowsCompletion ? "Suggested match" : "Use previous setup"
  const primarySuggestionTitle = primarySuggestionShowsCompletion
    ? primarySuggestion?.expense
    : primarySuggestionSetup
  const primarySuggestionDescription = primarySuggestionShowsCompletion
    ? `Will use ${primarySuggestionSetup}`
    : null
  const expenseAutocompleteCompletion =
    primarySuggestionIsPrefixMatch &&
    primarySuggestion.expense.length > expense.length
      ? primarySuggestion.expense.slice(expense.length)
      : ""
  const quickPickTagIds = new Set(quickPickTags.map((tag) => tag.id))
  const displayedQuickPickTags = [
    ...quickPickTags,
    ...tags.filter((tag) => !quickPickTagIds.has(tag.id)),
  ]
  const NewTagInputIcon = getTagIcon(newTagName || "Tag", newTagIconKey)

  const recurringDayNumber = parseInt(recurringBillingDay || "0", 10)
  const hasValidRecurringConfig =
    !makeRecurring ||
    recurringBillingType === "last_day" ||
    (Number.isInteger(recurringDayNumber) && recurringDayNumber >= 1 && recurringDayNumber <= 31)
  const optionalDetailsCount = [cardId, isSplit, makeRecurring, transactionAlreadyRecurring].filter(Boolean).length
  const displayAmount = amount || "00.00"
  const amountLength = displayAmount.length
  const amountInputStyle = {
    width: `${Math.min(Math.max(amountLength + 0.25, 5), 10.5)}ch`,
  } satisfies CSSProperties
  const amountTextClassName = amountLength > 7
    ? "text-4xl sm:text-5xl md:text-5xl"
    : "text-5xl sm:text-6xl md:text-6xl"
  const submitButtonLabel = (() => {
    if (isSubmitting) {
      return isEditMode ? "Saving..." : "Adding..."
    }

    if (!isEditMode && !normalizedAmount) {
      return "Enter amount"
    }

    if (!isEditMode && !tagId) {
      return "Choose tag"
    }

    return isEditMode ? "Save Changes" : "Add Transaction"
  })()
  const swipeDismiss = useSwipeDismiss({
    open,
    onDismiss: () => onOpenChange(false),
    scrollRef: scrollContainerRef,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...swipeDismiss}
        showCloseButton={false}
        className={cn(
          "flex h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] w-full grid-rows-none gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,44rem)] sm:w-[min(calc(100dvw-2rem),36rem)] sm:max-w-[36rem] sm:rounded-2xl sm:border",
          mobileDrawerDialogClassName
        )}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" autoComplete="off" data-form-type="other">
          <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 sm:py-4">
            <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg font-semibold sm:text-xl">
                  {isEditMode ? "Edit Transaction" : "New Transaction"}
                </DialogTitle>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {format(date, "EEE, MMM d")} · {categoryConfig[category].label}
                </p>
              </div>
              <DialogClose className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </div>

          <div ref={scrollContainerRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
              <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-5 sm:px-5">
                <label htmlFor="transaction-amount" className="block text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount
                </label>
                <div className="mt-3 flex justify-center">
                  <div className="inline-flex items-baseline gap-2">
                    <span className={cn("font-semibold leading-none text-muted-foreground", amountTextClassName)}>
                      $
                    </span>
                    <Input
                      ref={amountInputRef}
                      id="transaction-amount"
                      name="transaction_amount"
                      type="text"
                      inputMode="numeric"
                      enterKeyHint="next"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      placeholder="00.00"
                      value={amount}
                      style={amountInputStyle}
                      onBeforeInput={handleAmountBeforeInput}
                      onChange={(e) => setAmountFromDigits(e.target.value)}
                      onKeyDown={handleAmountKeyDown}
                      onPaste={handleAmountPaste}
                      className={cn(
                        "h-auto min-w-0 max-w-[68vw] border-0 bg-transparent p-0 text-left font-semibold leading-none tracking-normal shadow-none placeholder:text-muted-foreground/30 focus-visible:ring-0 dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                        amountTextClassName
                      )}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
                <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden sm:grid-cols-2">
                  <div className="min-w-0 space-y-2 sm:col-span-2">
                    <Label htmlFor="expense" className="text-sm font-medium">
                      Description
                    </Label>
                    <div className="relative">
                      <Input
                        ref={expenseInputRef}
                        id="expense"
                        placeholder="What did you spend on?"
                        value={expense}
                        onChange={(e) => setExpense(e.target.value)}
                        enterKeyHint={normalizedAmount && tagId ? "done" : "next"}
                        className="relative z-10 h-12 rounded-xl border-border/60 bg-transparent focus:border-foreground/20 dark:bg-transparent"
                        required
                      />
                      {expenseAutocompleteCompletion && (
                        <div
                          className="pointer-events-none absolute inset-0 z-20 flex h-12 items-center overflow-hidden rounded-xl px-3 text-base md:text-sm"
                          aria-hidden="true"
                        >
                          <span className="invisible whitespace-pre">{expense}</span>
                          <span className="whitespace-pre text-muted-foreground/55">{expenseAutocompleteCompletion}</span>
                        </div>
                      )}
                    </div>
                    {primarySuggestion && (
                      <button
                        type="button"
                        onClick={() => applySuggestion(primarySuggestion)}
                        aria-label={primarySuggestionShowsCompletion ? `Use ${primarySuggestion.expense}` : "Use previous transaction setup"}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {primarySuggestionLabel}
                          </p>
                          <p className="truncate text-sm font-semibold leading-5">
                            {primarySuggestionTitle}
                          </p>
                          {primarySuggestionDescription && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{primarySuggestionDescription}</p>
                          )}
                        </div>
                        <span className="inline-flex h-9 shrink-0 items-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground">
                          Apply
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="min-w-0 space-y-2 sm:col-span-2">
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
                            <p className="truncate text-xs text-muted-foreground">It will be selected for this transaction.</p>
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
                            <NewTagInputIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Tag name"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              className="h-12 rounded-xl border-border/60 pl-10"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  void handleCreateTag()
                                }
                              }}
                            />
                          </div>
                          <TagIconPicker
                            tagName={newTagName}
                            value={newTagIconKey}
                            onChange={setNewTagIconKey}
                            label={<Label className="text-xs font-medium text-muted-foreground">Icon</Label>}
                            fadeClassName="from-card via-card/80 to-transparent"
                            wrapOnDesktop={false}
                          />
                          <Button
                            type="button"
                            onClick={() => void handleCreateTag()}
                            disabled={!newTagName.trim() || isCreatingTag}
                            className="h-12 w-full rounded-xl px-4"
                          >
                            {isCreatingTag ? "Adding..." : "Add tag"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 max-w-full overflow-hidden">
                        {displayedQuickPickTags.length > 0 ? (
                          <FormChipRail
                            items={displayedQuickPickTags.map((tag) => {
                              const QuickPickIcon = getTagIcon(tag.name, tag.icon_key)
                              return {
                                value: tag.id,
                                label: tag.name.trim().replace(/\s+/g, " "),
                                icon: <QuickPickIcon className="h-4 w-4 shrink-0" />,
                                ariaLabel: tag.name,
                                title: tag.name,
                              } satisfies FormChipRailItem
                            })}
                            value={tagId}
                            onValueChange={setTagId}
                            ariaLabel="Choose a tag"
                          />
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                            Create a tag to use it for this transaction.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 max-w-full space-y-2 sm:col-span-2">
                    <Label className="text-sm font-medium">Category</Label>
                    <div className="grid min-w-0 max-w-full grid-cols-3 gap-2">
                      {(["needs", "wants", "savings"] as const).map((cat) => {
                        const config = categoryConfig[cat]
                        const isSelected = category === cat

                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={cn(
                              "relative h-11 cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 sm:h-12",
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

                  <div className="min-w-0 max-w-full space-y-2 sm:col-span-2">
                    <Label className="text-sm font-medium">Date</Label>
                    <div className="grid min-w-0 max-w-full grid-cols-[auto_auto_minmax(0,1fr)] gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 rounded-xl px-3 text-sm"
                        onClick={() => updateTransactionDate(new Date())}
                      >
                        Today
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 rounded-xl px-3 text-sm"
                        onClick={() => {
                          const yesterday = new Date()
                          yesterday.setDate(yesterday.getDate() - 1)
                          updateTransactionDate(yesterday)
                        }}
                      >
                        Yesterday
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-11 min-w-0 rounded-xl border-border/60 px-3 font-normal hover:border-foreground/20",
                              !date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {date ? format(date, "MMM d, yyyy") : "Pick date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => {
                              if (!d) {
                                return
                              }
                              updateTransactionDate(d)
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <button
                    type="button"
                    onClick={() => setShowMoreDetails((current) => !current)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={showMoreDetails}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">More details</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {optionalDetailsCount > 0 ? `${optionalDetailsCount} optional detail${optionalDetailsCount === 1 ? "" : "s"} set` : "Card, split, and recurring settings"}
                      </p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", showMoreDetails && "rotate-180")} />
                  </button>

                  {showMoreDetails && (
                    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden border-t border-border/50 p-4">
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
                          <div className="rounded-xl border border-border/60 bg-background p-3">
                            <div className="flex items-center justify-between gap-3 pb-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">Create card</p>
                                <p className="truncate text-xs text-muted-foreground">It will be selected for this transaction.</p>
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
                                  className="h-12 rounded-xl border-border/60 pl-10"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault()
                                      void handleCreateCard()
                                    }
                                  }}
                                />
                              </div>
                              <Button
                                type="button"
                                onClick={() => void handleCreateCard()}
                                disabled={!newCardName.trim() || isCreatingCard}
                                className="h-12 rounded-xl px-4"
                              >
                                {isCreatingCard ? "Adding..." : "Add card"}
                              </Button>
                            </div>
                          </div>
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
                              ...(isLoadingTaxonomy && cards.length === 0
                                ? [{
                                  value: "__loading",
                                  label: "Loading cards...",
                                  selectedTone: "neutral" as const,
                                  disabled: true,
                                }]
                                : []),
                            ]}
                            value={cardId}
                            onValueChange={(value) => {
                              if (value !== "__loading") {
                                setCardId(value)
                              }
                            }}
                            ariaLabel="Choose a card"
                            fadeClassName="from-card via-card/80 to-transparent"
                          />
                        )}
                      </div>

                      <div className="rounded-xl border border-border/60 p-3">
                        <label className="flex cursor-pointer items-center gap-3">
                          <Checkbox checked={isSplit} onCheckedChange={(checked) => setIsSplit(Boolean(checked))} />
                          <div>
                            <p className="text-sm font-medium">Split expense</p>
                            <p className="text-xs text-muted-foreground">Marks this transaction as your portion of a shared expense.</p>
                          </div>
                        </label>
                      </div>

                      {canCreateRecurringRule && (
                        <div className="space-y-3 rounded-xl border border-border/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <Label className="text-sm font-medium">Make recurring</Label>
                              <p className="text-xs text-muted-foreground">
                                {isEditMode
                                  ? "Create a recurring rule using this transaction as the first occurrence."
                                  : "Adds this expense automatically each month."}
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
                                  className="h-10 rounded-xl border-border/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isEditMode && transactionAlreadyRecurring && (
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                          <p className="text-sm font-medium">Already recurring</p>
                          <p className="text-xs text-muted-foreground">
                            This transaction is already linked to a recurring expense. Update the recurring rule from Settings.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/50 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-6 sm:pt-4">
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold"
              disabled={!amount || !expense || !tagId || isSubmitting || isLoadingTaxonomy || !hasValidRecurringConfig || (isEditMode && !hasEditChanges)}
            >
              {submitButtonLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
