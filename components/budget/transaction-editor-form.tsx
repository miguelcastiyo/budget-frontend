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
import type {
  Card as CardType,
  TransactionSuggestion,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from "@/lib/api/types"
import { Calendar } from "@/components/ui/calendar"
import { AmountInput } from "@/components/budget/amount-input"
import { FormChipRail, type FormChipRailItem } from "@/components/budget/form-chip-rail"
import { InlineCreateCardControl, InlineCreateTagControl } from "@/components/budget/inline-create-controls"
import { ContextPickerSheet } from "@/components/budget/context-picker-sheet"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, Check, ChevronDown, CreditCard, Delete, Plus, Star, X } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api/client"
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
import { initialRecurringSchedule, recurringSchedulePayload, shouldInitializeRecurringOnEnable } from "@/lib/domain/financial/recurring-form"
import { CATEGORY_CONFIG, hasRecurringSchedule, normalizeAmount, submitLabel } from "./transaction-editor-types"
import { useTransactionEditor } from "./use-transaction-editor"
import { TransactionDetailsSection } from "./transaction-details-section"
import { TransactionCategoryPicker } from "./transaction-category-picker"
import { canonicalIsoDate, canonicalMoney, canonicalNullableId, canonicalText, equalCanonicalSnapshots } from "@/lib/form-state/canonical-snapshot"
import { useQuickCapture } from "@/components/review/use-quick-capture"
import { getLocalDateKey } from "@/lib/date-filters"
import styles from "./v2-editor.module.css"
import { useAuth } from "@/components/auth/auth-provider"
import { clearRememberedCapture, getRememberedCapture } from "@/components/review/capture-recovery"
import { useInterfacePreference } from "@/components/layout/interface-preference"

import type { AddTransactionSheetProps } from "./transaction-editor-types"

function getYesterdayKey() { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); return format(yesterday, "yyyy-MM-dd") }
export function TransactionEditorForm({
  open,
  onOpenChange,
  onTransactionCreated,
  onTransactionUpdated,
  mode = "create",
  transaction = null,
  v2Create = false,
  initialCapture = false,
}: AddTransactionSheetProps) {
  const financialAuthority = useFinancialAuthority()
  const { profile } = useAuth()
  const { version } = useInterfacePreference()
  const v2Style = v2Create || (mode === "edit" && version === "v2")
  const isEditMode = mode === "edit" && transaction !== null
  const transactionAlreadyRecurring = transaction?.recurring_expense_id != null
  const editor = useTransactionEditor({ mode, transaction })
  const {
    date, setDate, expense, setExpense, amount, setAmount, category, setCategory, isSplit, setIsSplit,
    tagId, setTagId, cardId, setCardId, notes, setNotes, makeRecurring, setMakeRecurring,
    recurringEditScope, setRecurringEditScope, recurringBillingType, setRecurringBillingType,
    recurringBillingDay, setRecurringBillingDay, tags, setTags, quickPickTags, setQuickPickTags,
    cards, setCards, contexts, setContexts, showNewTag, setShowNewTag, newTagName, setNewTagName,
    newTagIconKey, setNewTagIconKey, showNewCard, setShowNewCard, newCardName, setNewCardName,
    contextId, setContextId, contextPickerOpen, setContextPickerOpen, showMoreDetails, setShowMoreDetails,
    isLoadingTaxonomy, setIsLoadingTaxonomy, isLoadingContexts, setIsLoadingContexts,
    contextLoadError, setContextLoadError, isSubmitting, setIsSubmitting, suggestions, setSuggestions,
    isCreatingTag, setIsCreatingTag, isCreatingCard, setIsCreatingCard, isCreatingContext, setIsCreatingContext,
    error, setError, notesError, setNotesError, amountInputRef, expenseInputRef, scrollContainerRef,
    suggestionRequestRef, appliedSuggestionExpenseRef, didAutoFocusOnOpenRef, recurringScheduleTouchedRef,
    canCreateRecurringRule,
  } = editor
  const [captureMode, setCaptureMode] = useState(initialCapture)
  const [captureKeypadOpen, setCaptureKeypadOpen] = useState(true)
  const [v2Picker, setV2Picker] = useState<"tag" | "card" | null>(null)
  const [v2PickerQuery, setV2PickerQuery] = useState("")
  const [captureBusy, setCaptureBusy] = useState(false)
  const [captureError, setCaptureError] = useState("")
  const [captureNotice, setCaptureNotice] = useState("")
  const saveAndNew = useRef(false)
  const v2Initialized = useRef(false)
  const quick = useQuickCapture({
    authority: v2Create ? financialAuthority.authority : null,
    busy: captureBusy,
    setBusy: setCaptureBusy,
    onError: setCaptureError,
    onNotice: setCaptureNotice,
    draft: v2Create ? { amount, setAmount, description: expense, setDescription: setExpense, date: format(date, "yyyy-MM-dd"), setDate: (value) => { const next = parseDateValue(value); if (next) setDate(next) } } : undefined,
    onSaved: () => { if (!saveAndNew.current) onOpenChange(false) },
    accountId: v2Create ? profile?.id : undefined,
  })
  const enterCaptureDigit = (key: string) => {
    if (key === "back") { setAmount(amount.slice(0, -1)); return }
    if (key === ".") { if (!amount.includes(".")) setAmount(`${amount || "0"}.`); return }
    const [whole = "", fraction = ""] = amount.split(".")
    if (fraction.length >= 2 || amount.replace(/\D/g, "").length >= 9) return
    setAmount(amount.includes(".") ? `${whole}.${fraction}${key}` : `${whole}${key}`)
  }
  const closeV2Picker = () => { setV2Picker(null); setV2PickerQuery("") }
  const filteredV2Tags = tags.filter(item => item.name.toLocaleLowerCase().includes(v2PickerQuery.trim().toLocaleLowerCase()))
  const filteredV2Cards = cards.filter(item => item.name.toLocaleLowerCase().includes(v2PickerQuery.trim().toLocaleLowerCase()))
  const transitionBlocked = isSubmitting || isCreatingTag || isCreatingCard || isCreatingContext || captureBusy || Boolean(quick.captureBatch)
  const dirty = Boolean(amount || expense || category !== "needs" || tagId || cardId || contextId || notes || isSplit || makeRecurring || showNewTag || newTagName || newTagIconKey || showNewCard || newCardName || format(date, "yyyy-MM-dd") !== getLocalDateKey())
  const requestOpenChange = (next: boolean) => {
    if (!v2Create || next) { onOpenChange(next); return }
    if (transitionBlocked) return
    if (dirty && !window.confirm("Discard this unfinished transaction?")) return
    onOpenChange(false)
  }

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
      const references = await financialAuthority.getTransactionReferences()
      setTags(references.tags)
      setQuickPickTags(references.quickPickTags)
      setCards(sortCards(references.cards))
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

    if (!v2Create || !v2Initialized.current) { resetForm(); v2Initialized.current = true }
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
  }, [expense, financialAuthority, isEditMode, open])

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
      setTags((prev) => [...prev.filter((tag) => tag.id !== created.id), created])
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
      setCards((prev) => sortCards([...prev.filter((card) => card.id !== created.id), created]))
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
      setContexts((previous) => [...previous.filter((context) => context.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)))
      setContextId(created.id)
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.error.message : "Unable to create context")
    } finally {
      setIsCreatingContext(false)
    }
  }

  const normalizedDate = format(date, "yyyy-MM-dd")
  const normalizedExpense = expense.trim()
  const normalizedAmount = normalizeAmount(amount)
  const normalizedTransactionSnapshot = {
    date: canonicalIsoDate(normalizedDate),
    expense: canonicalText(normalizedExpense),
    amount: canonicalMoney(normalizedAmount),
    category,
    is_split: isSplit,
    notes: normalizeTransactionNotesForSubmit(notes),
    tag_id: canonicalNullableId(tagId),
    card_id: canonicalNullableId(cardId),
    context_id: canonicalNullableId(contextId),
  }
  const baselineTransactionSnapshot = isEditMode && transaction
    ? {
      date: canonicalIsoDate(transaction.date),
      expense: canonicalText(transaction.expense),
      amount: canonicalMoney(transaction.amount),
      category: transaction.category,
      is_split: transaction.is_split,
      notes: normalizeTransactionNotesForSubmit(transaction.notes ?? ""),
      tag_id: canonicalNullableId(transaction.tag.id),
      card_id: canonicalNullableId(transaction.card?.id),
      context_id: canonicalNullableId(transaction.context?.id),
    }
    : null
  const hasEditChanges = !isEditMode || !baselineTransactionSnapshot
    ? true
    : !equalCanonicalSnapshots(normalizedTransactionSnapshot, baselineTransactionSnapshot) || (makeRecurring && !transactionAlreadyRecurring)
  const hasRecurringTemplateChanges = !isEditMode || !transaction
    ? false
    : !equalCanonicalSnapshots(
      { expense: canonicalText(expense), amount: canonicalMoney(amount), category, tag_id: canonicalNullableId(tagId), card_id: canonicalNullableId(cardId) },
      { expense: canonicalText(transaction.expense), amount: canonicalMoney(transaction.amount), category: transaction.category, tag_id: canonicalNullableId(transaction.tag.id), card_id: canonicalNullableId(transaction.card?.id) }
    )

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

  const categoryConfig = CATEGORY_CONFIG
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
  const hasValidRecurringConfig = hasRecurringSchedule(makeRecurring, recurringBillingType, recurringBillingDay)
  const moreDetailsSummary = "Optional transaction details"
  const submitButtonLabel = submitLabel({ isEditMode, isSubmitting, recurringEditScope, normalizedAmount, tagId })
  const swipeDismiss = useSwipeDismiss({
    open,
    onDismiss: () => requestOpenChange(false),
    scrollRef: scrollContainerRef,
  })

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent
        {...swipeDismiss}
        showCloseButton={false}
        className={cn(
          "flex h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] w-full grid-rows-none gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,44rem)] sm:w-[min(calc(100dvw-2rem),36rem)] sm:max-w-[36rem] sm:rounded-2xl sm:border",
          mobileDrawerDialogClassName,
          v2Style && styles.surface
        )}
      >
        {v2Create && captureMode && <form onSubmit={quick.capture} className={styles.capture} aria-label="Quick Capture">
          <div className={styles.captureHeader}><div><DialogTitle>Quick Capture</DialogTitle><p>Capture now, organize later.</p></div><DialogClose aria-label="Close" disabled={transitionBlocked}><X size={20} /></DialogClose></div>
          <div className={styles.captureBody}>
            <label className={styles.amountLabel} htmlFor="quick-capture-amount">Amount</label>
            <AmountInput ref={quick.amountRef} id="quick-capture-amount" name="capture_amount" value={amount} onValueChange={setAmount} label="" readOnly className={styles.captureAmount} />
            <label className={styles.captureDescription}>Description<input value={expense} onFocus={() => setCaptureKeypadOpen(false)} disabled={Boolean(quick.captureBatch)} onChange={(event) => setExpense(event.target.value)} placeholder="What was it?" enterKeyHint="done" /></label>
            <div className={styles.quickDates} role="group" aria-label="Date">
              <button type="button" aria-pressed={format(date, "yyyy-MM-dd") === getLocalDateKey()} onClick={() => setDate(new Date())}>Today</button>
              <button type="button" aria-pressed={format(date, "yyyy-MM-dd") === getYesterdayKey()} onClick={() => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); setDate(yesterday) }}>Yesterday</button>
              <label className={styles.dateOther}>{format(date, "yyyy-MM-dd") !== getLocalDateKey() && format(date, "yyyy-MM-dd") !== getYesterdayKey() ? format(date, "MMM d") : "Other"}<input aria-label="Choose date" type="date" max={getLocalDateKey()} value={format(date, "yyyy-MM-dd")} disabled={Boolean(quick.captureBatch)} onChange={(event) => { const next = parseDateValue(event.target.value); if (next) setDate(next) }} /></label>
            </div>
            {captureKeypadOpen && !quick.captureBatch && <div className={styles.captureKeypad} role="group" aria-label="Amount keypad">{["1","2","3","4","5","6","7","8","9",".","0","back"].map((key, index) => <button key={key} type="button" style={{ gridColumn: index % 3 + 1, gridRow: Math.floor(index / 3) + 1 }} aria-label={key === "back" ? "Delete amount digit" : key === "." ? "Decimal point" : key} onClick={() => enterCaptureDigit(key)}>{key === "back" ? <Delete size={18} /> : key}</button>)}<button type="button" className={styles.keypadDone} onClick={() => setCaptureKeypadOpen(false)}>Done <Check size={16} /></button></div>}
            <p className={styles.hint}>{quick.captureBatch ? "The save outcome is uncertain. Retry the same save or synchronize." : "Enter an amount, a description, or both."}</p>
            {captureError && <p role="alert" className={styles.error}>{captureError}</p>}{captureNotice && <p role="status" className={styles.notice}>{captureNotice}</p>}
            {quick.captureBatch && <button type="button" disabled={captureBusy || !financialAuthority.authority} onClick={() => void (async () => { const account = profile?.id ?? ""; const id = getRememberedCapture(account); if (!id || !financialAuthority.authority) return; setCaptureBusy(true); try { await financialAuthority.syncFinancialState(); if (financialAuthority.authority.getState().pendingTransactions.some(item => item.id === id)) { clearRememberedCapture(account, id); quick.resolveConfirmed(); setAmount(""); setExpense(""); setDate(new Date()); setCaptureNotice("The capture was found in Review."); setCaptureError("") } else setCaptureError("The save outcome is still uncertain. Retry or sync again.") } catch { setCaptureError("Unable to sync Review. The save outcome remains uncertain.") } finally { setCaptureBusy(false) } })()}>Sync Review</button>}
          </div>
          <div className={styles.actions}><button type="submit" disabled={captureBusy || !financialAuthority.authority} onClick={() => { saveAndNew.current = false }}>Save to Review</button><button type="submit" disabled={captureBusy || !financialAuthority.authority} onClick={() => { saveAndNew.current = true }}>Save &amp; New</button><button type="button" disabled={transitionBlocked} onClick={() => { setCaptureMode(false); setCaptureKeypadOpen(false) }}>Full Entry</button></div>
        </form>}
        <form onSubmit={handleSubmit} className={cn("flex min-h-0 flex-1 flex-col", v2Create && styles.fullEntry, v2Create && captureMode && "hidden")} autoComplete="off" data-form-type="other">
          <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 sm:py-4">
            <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg font-semibold sm:text-xl">
                  {isEditMode ? "Edit Transaction" : "New Transaction"}
                </DialogTitle>
                {!v2Create && <p className="mt-0.5 truncate text-xs text-muted-foreground">{format(date, "EEE, MMM d")} · {categoryConfig[category].label}</p>}
                {v2Create && financialAuthority.pendingCaptureEnabled && <div className={styles.modeSwitch} role="group" aria-label="Entry mode"><button type="button" disabled={transitionBlocked} aria-pressed={false} onClick={() => { closeV2Picker(); setCaptureMode(true); setCaptureKeypadOpen(true) }}>Quick Capture</button><span aria-current="page">Full Entry</span></div>}
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
                    <div className="min-w-0 max-w-full space-y-2 sm:col-span-2">
                    <Label className="text-sm font-medium">Category</Label>
                    <TransactionCategoryPicker value={category} onChange={setCategory} className={v2Create ? styles.categoryPicker : undefined} />
                  </div>

                  <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Tag</Label>
                      {!showNewTag && !v2Create && (
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
                        {v2Create ? <div className={styles.fieldPicker}>
                          <button type="button" aria-haspopup="listbox" aria-expanded={v2Picker === "tag"} onClick={() => { setV2Picker(v2Picker === "tag" ? null : "tag"); setV2PickerQuery("") }}><span>{tags.find(item => item.id === tagId)?.name ?? "Choose a tag"}</span><ChevronDown size={16} /></button>
                          {v2Picker === "tag" && <div className={styles.pickerPanel}><input aria-label="Search tags" value={v2PickerQuery} onChange={event => setV2PickerQuery(event.target.value)} placeholder="Search tags" />{filteredV2Tags.map(item => <button type="button" key={item.id} onClick={() => { setTagId(item.id); closeV2Picker() }}>{item.name}{item.id === tagId && <Check size={16} />}</button>)}<button type="button" onClick={() => { closeV2Picker(); setNewTagIconKey(""); setShowNewTag(true) }}><Plus size={16} /> New tag</button></div>}
                        </div> : displayedQuickPickTags.length > 0 ? (
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
                          <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">Create a tag to use it for this transaction.</div>
                        )}
                      </div>
                    )}
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
                        <PopoverContent className={cn("w-auto p-0", v2Style && styles.surface)} align="end">
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

                {v2Create && <div className={styles.secondaryFields}>
                  <div className={styles.fieldPicker}>
                    <button type="button" aria-haspopup="listbox" aria-expanded={v2Picker === "card"} onClick={() => { setV2Picker(v2Picker === "card" ? null : "card"); setV2PickerQuery("") }}><span>Card</span><span>{cards.find(item => item.id === cardId)?.name ?? "None"}</span><ChevronDown size={16} /></button>
                    {v2Picker === "card" && <div className={styles.pickerPanel}><input aria-label="Search cards" value={v2PickerQuery} onChange={event => setV2PickerQuery(event.target.value)} placeholder="Search cards" /><button type="button" onClick={() => { setCardId(""); closeV2Picker() }}>No card</button>{filteredV2Cards.map(item => <button type="button" key={item.id} onClick={() => { setCardId(item.id); closeV2Picker() }}>{item.name}{item.id === cardId && <Check size={16} />}</button>)}<button type="button" onClick={() => { closeV2Picker(); setShowNewCard(true) }}><Plus size={16} /> New card</button></div>}
                  </div>
                  {showNewCard && <InlineCreateCardControl name={newCardName} onNameChange={setNewCardName} onCancel={() => { setShowNewCard(false); setNewCardName("") }} onSubmit={() => void handleCreateCard()} isSubmitting={isCreatingCard} subtitle="It will be selected for this transaction." surfaceClassName="bg-background" />}
                  <div className={styles.fieldPicker}><button type="button" aria-haspopup="dialog" onClick={() => setContextPickerOpen(true)}><span>Context</span><span>{contexts.find(item => item.id === contextId)?.name ?? "None"}</span><ChevronDown size={16} /></button></div>
                </div>}
                {/* Classic and v1-only transaction fields remain available in Classic. */}
                <div className={cn("min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/60 bg-card", v2Create && "hidden")}>
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
                          {!showNewCard && !v2Create && (
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
                        ) : v2Create ? <div className={styles.fieldPicker}>
                            <button type="button" aria-haspopup="listbox" aria-expanded={v2Picker === "card"} onClick={() => { setV2Picker(v2Picker === "card" ? null : "card"); setV2PickerQuery("") }}><span>{cards.find(item => item.id === cardId)?.name ?? "No card"}</span><ChevronDown size={16} /></button>
                            {v2Picker === "card" && <div className={styles.pickerPanel}><input aria-label="Search cards" value={v2PickerQuery} onChange={event => setV2PickerQuery(event.target.value)} placeholder="Search cards" /><button type="button" onClick={() => { setCardId(""); closeV2Picker() }}>No card</button>{filteredV2Cards.map(item => <button type="button" key={item.id} onClick={() => { setCardId(item.id); closeV2Picker() }}>{item.name}{item.id === cardId && <Check size={16} />}</button>)}<button type="button" onClick={() => { closeV2Picker(); setShowNewCard(true) }}><Plus size={16} /> New card</button></div>}
                          </div> : <FormChipRail
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
                          />}
                      </div>

                      <TransactionDetailsSection
                        isSplit={isSplit}
                        onSplitChange={setIsSplit}
                        notes={notes}
                        notesError={notesError}
                        onNotesChange={(value) => {
                          setNotes(value)
                          if (notesError) setNotesError(validateTransactionNotes(value))
                        }}
                        canCreateRecurringRule={canCreateRecurringRule}
                        makeRecurring={makeRecurring}
                        onMakeRecurringChange={setMakeRecurring}
                        recurringBillingType={recurringBillingType}
                        onBillingTypeChange={setRecurringBillingType}
                        recurringBillingDay={recurringBillingDay}
                        onBillingDayChange={setRecurringBillingDay}
                        isEditMode={isEditMode}
                        transactionAlreadyRecurring={transactionAlreadyRecurring}
                        recurringEditScope={recurringEditScope}
                        onEditScopeChange={setRecurringEditScope}
                        onScheduleTouched={() => { recurringScheduleTouchedRef.current = true }}
                        shouldInitializeSchedule={(nextValue) => shouldInitializeRecurringOnEnable(nextValue, makeRecurring, recurringScheduleTouchedRef.current)}
                        onInitializeSchedule={() => applyRecurringDefaultsFromDate(date)}
                      />
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
      contentClassName={v2Style ? styles.surface : undefined}
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
