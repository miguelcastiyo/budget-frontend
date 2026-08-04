import { useRef, useState } from "react"
import type {
  Category,
  Card as CardType,
  Context,
  RecurringBillingType,
  Tag,
  Transaction,
  TransactionSuggestion,
} from "@/lib/api/types"
import type { RecurringEditScope } from "./transaction-editor-types"

export function useTransactionEditor({
  mode,
  transaction,
}: {
  mode: "create" | "edit"
  transaction: Transaction | null
}) {
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

  const amountInputRef = useRef<HTMLInputElement>(null)
  const expenseInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const suggestionRequestRef = useRef(0)
  const appliedSuggestionExpenseRef = useRef<string | null>(null)
  const didAutoFocusOnOpenRef = useRef(false)
  const recurringScheduleTouchedRef = useRef(false)

  const isEditMode = mode === "edit" && transaction !== null
  const transactionAlreadyRecurring = transaction?.recurring_expense_id != null

  return {
    date, setDate, expense, setExpense, amount, setAmount, category, setCategory,
    isSplit, setIsSplit, tagId, setTagId, cardId, setCardId, notes, setNotes,
    makeRecurring, setMakeRecurring, recurringEditScope, setRecurringEditScope,
    recurringBillingType, setRecurringBillingType, recurringBillingDay, setRecurringBillingDay,
    tags, setTags, quickPickTags, setQuickPickTags, cards, setCards, contexts, setContexts,
    showNewTag, setShowNewTag, newTagName, setNewTagName, newTagIconKey, setNewTagIconKey,
    showNewCard, setShowNewCard, newCardName, setNewCardName, contextId, setContextId,
    contextPickerOpen, setContextPickerOpen, showMoreDetails, setShowMoreDetails,
    isLoadingTaxonomy, setIsLoadingTaxonomy, isLoadingContexts, setIsLoadingContexts,
    contextLoadError, setContextLoadError, isSubmitting, setIsSubmitting, suggestions, setSuggestions,
    isCreatingTag, setIsCreatingTag, isCreatingCard, setIsCreatingCard,
    isCreatingContext, setIsCreatingContext, error, setError, notesError, setNotesError,
    amountInputRef, expenseInputRef, scrollContainerRef, suggestionRequestRef,
    appliedSuggestionExpenseRef, didAutoFocusOnOpenRef, recurringScheduleTouchedRef,
    isEditMode, transactionAlreadyRecurring, canCreateRecurringRule: !isEditMode || !transactionAlreadyRecurring,
  }
}
