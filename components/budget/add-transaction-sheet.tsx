"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  Context,
  Transaction,
  TransactionSuggestion,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from "@/lib/api/types"
import { Calendar } from "@/components/ui/calendar"
import { AmountInput } from "@/components/budget/amount-input"
import { FormChipRail, type FormChipRailItem } from "@/components/budget/form-chip-rail"
import { InlineCreateCardControl, InlineCreateTagControl } from "@/components/budget/inline-create-controls"
import { ContextPickerSheet } from "@/components/budget/context-picker-sheet"
import { TransactionNotesField } from "@/components/budget/transaction-notes-field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, ChevronDown, CreditCard, Plus, Star, X } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ApiError, apiClient } from "@/lib/api/client"
import { sortCards } from "@/lib/cards"
import { parseDateValue } from "@/lib/date-filters"
import {
  normalizeTransactionNotesForSubmit,
  validateTransactionNotes,
} from "@/lib/transaction-notes"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
import { getContextIcon, getTagIcon } from "@/lib/tag-icons"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { tagQuickPicksFromState, taxonomyFromState } from "@/lib/domain/financial/view-models"
import { initialRecurringSchedule, recurringSchedulePayload, shouldInitializeRecurringOnEnable } from "@/lib/domain/financial/recurring-form"

interface AddTransactionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTransactionCreated?: () => void
  onTransactionUpdated?: (transaction: Transaction) => void
  mode?: "create" | "edit"
  transaction?: Transaction | null
}
type RecurringEditScope = "transaction" | "future"

export function AddTransactionSheet({
  open,
  onOpenChange,
  onTransactionCreated,
  onTransactionUpdated,
  mode = "create",
  transaction = null,
}: AddTransactionSheetProps) {
  const financialAuthority = useFinancialAuthority()
  const [date, setDate] = useState<Date>(new Date())
  const [expense, setExpense] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<Category>("needs")
  const [isSplit, setIsSplit] = useState(false)
  const [tagId, setTagId] = useState("")
  const [cardId, setCardId] = useState("")
  const [notes, setNotes] = useState("")
  const [makeRecurring, setMakeRecurring] = useState(false)
  const [recurringEditScope, setRecurringEditScope] = useState<RecurringEditScope>("transaction")
  const [recurringBillingType, setRecurringBillingType] = useState<RecurringBillingType>("day_of_month")
  const [recurringBillingDay, setRecurringBillingDay] = useState("1")

  const [tags, setTags] = useState<Tag[]>([])
  const [quickPickTags, setQuickPickTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<CardType[]>([])
  const [contexts, setContexts] = useState<Context[]>([])

  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagIconKey, setNewTagIconKey] = useState("")
  const [showNewCard, setShowNewCard] = useState(false)
  const [newCardName, setNewCardName] = useState("")
  const [contextId, setContextId] = useState("")
  const [contextPickerOpen, setContextPickerOpen] = useState(false)
  const [showMoreDetails, setShowMoreDetails] = useState(false)

  const [isLoadingTaxonomy, setIsLoadingTaxonomy] = useState(false)
  const [isLoadingContexts, setIsLoadingContexts] = useState(false)
  const [contextLoadError, setContextLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<TransactionSuggestion[]>([])
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [isCreatingCard, setIsCreatingCard] = useState(false)
  const [isCreatingContext, setIsCreatingContext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notesError, setNotesError] = useState<string | null>(null)

  const isEditMode = mode === "edit" && transaction !== null
  const transactionAlreadyRecurring = transaction?.recurring_expense_id != null
  const canCreateRecurringRule = !isEditMode || !transactionAlreadyRecurring
  const amountInputRef = useRef<HTMLInputElement>(null)
  const expenseInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const suggestionRequestRef = useRef(0)
  const appliedSuggestionExpenseRef = useRef<string | null>(null)
  const didAutoFocusOnOpenRef = useRef(false)
  const recurringScheduleTouchedRef = useRef(false)

  const parseTransactionDate = (dateStr: string): Date => {
    return parseDateValue(dateStr) ?? new Date()
  }

  const applyRecurringDefaultsFromDate = (selectedDate: Date) => {
    const schedule = initialRecurringSchedule(selectedDate)
    setRecurringBillingDay(schedule.billingDay)
    setRecurringBillingType(schedule.billingType)
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
      if (financialAuthority.mode === "encrypted") {
        const state = financialAuthority.authority?.getState()
        if (!state) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
        const references = taxonomyFromState(state)
        setTags(references.tags)
        setQuickPickTags(tagQuickPicksFromState(state, 5))
        setCards(sortCards(references.cards))
        return
      }
      throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load tags and cards")
      }
    } finally {
      setIsLoadingTaxonomy(false)
    }
  }, [financialAuthority])

  const loadContexts = useCallback(async () => {
    setIsLoadingContexts(true)
    setContextLoadError(null)
    try {
      const response = await financialAuthority.getContexts()
      setContexts(response.items)
    } catch (err) {
      setContextLoadError(err instanceof ApiError ? err.error.message : "Unable to load contexts")
    } finally {
      setIsLoadingContexts(false)
    }
  }, [financialAuthority])

  useEffect(() => {
    if (contextPickerOpen) {
      void loadContexts()
    }
  }, [contextPickerOpen, loadContexts])

  useEffect(() => {
    if (!open) {
      setContextPickerOpen(false)
    }
  }, [open])

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
      setContextId(transaction.context?.id ?? "")
      setNotes(transaction.notes ?? "")
      setShowNewTag(false)
      setNewTagName("")
      setNewTagIconKey("")
      setShowNewCard(false)
      setNewCardName("")
      setShowMoreDetails(Boolean(transaction.card || transaction.context || transaction.is_split || transaction.recurring_expense_id != null))
      setMakeRecurring(false)
      setRecurringEditScope("transaction")
      setRecurringBillingType("day_of_month")
      setRecurringBillingDay(String(parseTransactionDate(transaction.date).getDate()))
      recurringScheduleTouchedRef.current = false
      setSuggestions([])
      setError(null)
      setNotesError(null)
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
      financialAuthority.getTransactionSuggestions(query, 5)
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
  }, [expense, financialAuthority.mode, isEditMode, open])

  const resetForm = () => {
    const now = new Date()
    setExpense("")
    setAmount("")
    setCategory("needs")
    setIsSplit(false)
    setTagId("")
    setCardId("")
    setContextId("")
    setNotes("")
    setDate(now)
    setShowNewTag(false)
    setNewTagName("")
    setNewTagIconKey("")
    setShowNewCard(false)
    setNewCardName("")
    setShowMoreDetails(false)
    setMakeRecurring(false)
    setRecurringEditScope("transaction")
    setSuggestions([])
    appliedSuggestionExpenseRef.current = null
    recurringScheduleTouchedRef.current = false
    applyRecurringDefaultsFromDate(now)
    setError(null)
    setNotesError(null)
  }

  const updateTransactionDate = (nextDate: Date) => {
    setDate(nextDate)
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
      const created = await financialAuthority.createTag({
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
      const created = await financialAuthority.createCard({ name })
      setCards((prev) => sortCards([...prev, created]))
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

  const handleCreateContext = async (name: string, iconKey: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setIsCreatingContext(true)
    setContextLoadError(null)
    try {
      const created = await financialAuthority.createContext({ name: trimmedName, icon_key: iconKey || null })
      setContexts((previous) => [...previous, created].sort((a, b) => a.name.localeCompare(b.name)))
      setContextId(created.id)
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.error.message : "Unable to create context")
    } finally {
      setIsCreatingContext(false)
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
    notes: normalizeTransactionNotesForSubmit(notes),
    tag_id: tagId,
    card_id: cardId || undefined,
    context_id: contextId || null,
  }
  const baselineTransactionPayload = isEditMode && transaction
    ? {
      date: format(parseTransactionDate(transaction.date), "yyyy-MM-dd"),
      expense: transaction.expense.trim(),
      amount: Number.parseFloat(transaction.amount).toFixed(2),
      category: transaction.category,
      is_split: transaction.is_split,
      notes: transaction.notes,
      tag_id: transaction.tag.id,
      card_id: transaction.card?.id || undefined,
      context_id: transaction.context?.id || null,
    }
    : null
  const hasEditChanges = !isEditMode || !baselineTransactionPayload
    ? true
    : JSON.stringify(normalizedTransactionPayload) !== JSON.stringify(baselineTransactionPayload) || (makeRecurring && !transactionAlreadyRecurring)
  const hasRecurringTemplateChanges = !isEditMode || !transaction
    ? false
    : normalizedExpense !== transaction.expense.trim() || normalizedAmount !== Number.parseFloat(transaction.amount).toFixed(2) || category !== transaction.category || tagId !== transaction.tag.id || (cardId || undefined) !== (transaction.card?.id || undefined)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextNotesError = validateTransactionNotes(notes)
    const normalizedNotes = normalizeTransactionNotesForSubmit(notes)

    if (nextNotesError) {
      setNotesError(nextNotesError)
      return
    }

    if (!tagId) {
      setError("Please select a tag")
      return
    }

    if (isEditMode && transactionAlreadyRecurring && recurringEditScope === "future" && !hasRecurringTemplateChanges) {
      setError("Change the amount, description, category, tag, or card before applying to future transactions.")
      return
    }

    if (!normalizedAmount) {
      setError("Please enter a valid amount")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setNotesError(null)

    try {
      if (isEditMode && transaction) {
        const payload: UpdateTransactionRequest = {
          date: normalizedDate,
          expense: expense.trim(),
          amount: normalizedAmount,
          category,
          is_split: isSplit,
          notes: normalizedNotes,
          tag_id: tagId,
          card_id: cardId || undefined,
          context_id: contextId || null,
        }
        const updated = recurringEditScope === "future"
          ? await financialAuthority.updateRecurringTransaction(transaction, payload)
          : await financialAuthority.updateTransaction(transaction, payload)

        if (makeRecurring && !transactionAlreadyRecurring) {
          const startsMonth = format(date, "yyyy-MM")

          await financialAuthority.createRecurringExpense({
            expense: expense.trim(),
            amount: normalizedAmount,
            category,
            tag_id: tagId,
            card_id: cardId || null,
            ...recurringSchedulePayload(recurringBillingType, recurringBillingDay),
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
        if (contextId) {
          payload.context_id = contextId
        }
        if (normalizedNotes !== null) {
          payload.notes = normalizedNotes
        }

        const created = await financialAuthority.createTransaction(payload)

        if (makeRecurring) {
          const startsMonth = format(date, "yyyy-MM")

          try {
            await financialAuthority.createRecurringExpense({
              expense: expense.trim(),
              amount: normalizedAmount,
              category,
              tag_id: tagId,
              card_id: cardId || null,
              ...recurringSchedulePayload(recurringBillingType, recurringBillingDay),
              starts_month: startsMonth,
              is_active: true,
              seed_transaction_id: created.id,
            })
          } catch (recurringError) {
            try {
              await financialAuthority.deleteTransaction(created)
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
        const fieldError = err.error.details?.find((detail) => detail.field === "notes")
        if (fieldError) {
          setNotesError(
            fieldError.message.includes("255")
              ? "Notes must be 255 characters or fewer."
              : fieldError.message
          )
        }
        setError(fieldError && err.error.details?.length === 1 ? null : err.error.message)
      } else {
        const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : ""
        const recurringMessages: Record<string, string> = {
          RECURRING_SOURCE_NOT_FOUND: "This transaction is no longer linked to a recurring commitment. Refresh and try again.",
          RECURRING_PROPAGATION_CONFLICT: "The recurring timeline has changed. Edit the future version from Settings → Recurring first.",
          RECURRING_FUTURE_VERSION_ALREADY_MATERIALIZED: "That future version has already posted. It can no longer be changed as a future version.",
          RECURRING_NO_TEMPLATE_CHANGES: "Change the amount, description, category, tag, or card before applying to future transactions.",
        }
        setError(recurringMessages[code] ?? (isEditMode ? "Unable to update transaction" : "Unable to create transaction"))
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
  const cardChipLabel = (card: CardType) => (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span>{card.name.trim().replace(/\s+/g, " ")}</span>
      {card.is_favorite && <Star className="h-3 w-3 fill-amber-400 text-amber-500" />}
    </span>
  )
  const recurringDayNumber = parseInt(recurringBillingDay || "0", 10)
  const hasValidRecurringConfig =
    !makeRecurring ||
    recurringBillingType === "last_day" ||
    (Number.isInteger(recurringDayNumber) && recurringDayNumber >= 1 && recurringDayNumber <= 31)
  const moreDetailsSummary = "Optional transaction details"
  const submitButtonLabel = (() => {
    if (isSubmitting) {
      return recurringEditScope === "future" ? "Applying..." : isEditMode ? "Saving..." : "Adding..."
    }

    if (!isEditMode && !normalizedAmount) {
      return "Enter amount"
    }

    if (!isEditMode && !tagId) {
      return "Choose tag"
    }

    return isEditMode ? (recurringEditScope === "future" ? "Save and apply to future" : "Save Changes") : "Add Transaction"
  })()
  const swipeDismiss = useSwipeDismiss({
    open,
    onDismiss: () => onOpenChange(false),
    scrollRef: scrollContainerRef,
  })

  return (
    <>
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
              <AmountInput
                ref={amountInputRef}
                id="transaction-amount"
                name="transaction_amount"
                value={amount}
                onValueChange={setAmount}
                onEnter={focusExpenseInput}
                required
              />

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
                        className="relative z-10 h-12 rounded-xl border-border/60 bg-transparent focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
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
                        onSubmit={() => void handleCreateTag()}
                        isSubmitting={isCreatingTag}
                        subtitle="It will be selected for this transaction."
                      />
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

                {/* Notes intentionally live inside More details so optional context does not slow down quick transaction logging. */}
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
                        {moreDetailsSummary}
                      </p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", showMoreDetails && "rotate-180")} />
                  </button>

                  {showMoreDetails && (
                    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden border-t border-border/50 p-4">
                      <div className="min-w-0 max-w-full space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Context</Label>
                        </div>
                        {contextId ? (() => {
                          const selectedContext = contexts.find((context) => context.id === contextId) ?? transaction?.context
                          const SelectedContextIcon = selectedContext ? getContextIcon(selectedContext.name, selectedContext.icon_key) : null
                          return selectedContext ? (
                            <div className="flex min-w-0 items-center gap-2">
                              <button type="button" onClick={() => setContextPickerOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-left hover:border-foreground/20">
                                {SelectedContextIcon && <SelectedContextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">{selectedContext.name}</span>
                              </button>
                              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Remove context" onClick={() => setContextId("")}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null
                        })() : (
                          <button
                            type="button"
                            onClick={() => setContextPickerOpen(true)}
                            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            aria-label="Choose a context for this transaction"
                          >
                            <span>Choose a context for this transaction</span>
                            <Plus className="h-4 w-4 shrink-0" />
                          </button>
                        )}
                      </div>

                      <div className="min-w-0 max-w-full space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Card</Label>
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
                            onSubmit={() => void handleCreateCard()}
                            isSubmitting={isCreatingCard}
                            subtitle="It will be selected for this transaction."
                            surfaceClassName="bg-background"
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
                                label: cardChipLabel(card),
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
                        <div className="space-y-2.5 rounded-xl border border-border/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <Label className="text-sm font-medium">Make recurring</Label>
                              <p className="text-xs text-muted-foreground">
                                Automatically add this every month
                              </p>
                            </div>
                            <Switch
                              checked={makeRecurring}
                              onCheckedChange={(checked) => {
                                setMakeRecurring(checked)
                                if (shouldInitializeRecurringOnEnable(checked, makeRecurring, recurringScheduleTouchedRef.current)) {
                                  applyRecurringDefaultsFromDate(date)
                                }
                              }}
                            />
                          </div>

                          {makeRecurring && (
                            <div className="min-w-0">
                              <Label className="text-xs text-muted-foreground">Schedule</Label>
                              <Select
                                value={recurringBillingType}
                                onValueChange={(value) => {
                                  recurringScheduleTouchedRef.current = true
                                  setRecurringBillingType(value as RecurringBillingType)
                                }}
                              >
                                <SelectTrigger aria-label="Choose recurring schedule" className="mt-1.5 h-11 w-full min-w-0 rounded-xl border-border/60 text-left">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-w-[calc(100vw-2rem)]">
                                  <SelectItem value="day_of_month">Specific day each month</SelectItem>
                                  <SelectItem value="last_day">Last day of each month</SelectItem>
                                </SelectContent>
                              </Select>
                              {recurringBillingType === "day_of_month" && (
                                <div className="mt-2">
                                  <Label htmlFor="recurring-billing-day" className="text-xs text-muted-foreground">Day of month</Label>
                                  <Input
                                    id="recurring-billing-day"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    enterKeyHint="done"
                                    value={recurringBillingDay}
                                    onChange={(event) => {
                                      recurringScheduleTouchedRef.current = true
                                      setRecurringBillingDay(event.target.value)
                                    }}
                                    placeholder="1-31"
                                    className="mt-1.5 h-11 w-full rounded-xl border-border/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isEditMode && transactionAlreadyRecurring && (
                        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                          <div>
                            <p className="text-sm font-medium">Apply changes to</p>
                            <p className="text-xs text-muted-foreground">Past transactions stay unchanged.</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {([ ["transaction", "This transaction only"], ["future", "This and future recurring transactions"] ] as const).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setRecurringEditScope(value)}
                                className={cn("rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors", recurringEditScope === value ? "border-primary bg-primary/10 text-foreground" : "border-border/60 bg-background text-muted-foreground hover:text-foreground")}
                                aria-pressed={recurringEditScope === value}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {recurringEditScope === "future" && <p className="text-xs text-muted-foreground">Description, amount, category, tag, and card will apply from next month. Date, notes, and split status stay on this transaction.</p>}
                        </div>
                      )}

                      <div className="space-y-2">
                        <TransactionNotesField
                          value={notes}
                          onChange={(value) => {
                            setNotes(value)
                            if (notesError) {
                              setNotesError(validateTransactionNotes(value))
                            }
                          }}
                          error={notesError}
                        />
                      </div>
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
      <ContextPickerSheet
      open={contextPickerOpen}
      onOpenChange={setContextPickerOpen}
      contexts={contexts}
      selectedContextId={contextId}
      isLoading={isLoadingContexts}
      error={contextLoadError}
      onRetry={() => void loadContexts()}
      onSelect={setContextId}
      onCreate={handleCreateContext}
      />
    </>
  )
}
