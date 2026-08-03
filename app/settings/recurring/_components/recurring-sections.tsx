"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, CreditCard, Folder, Pencil, Plus, Repeat, Star, Tag as TagGlyph, Trash2 } from "lucide-react"
import { AmountInput } from "@/components/budget/amount-input"
import { FormChipRail, type FormChipRailItem } from "@/components/budget/form-chip-rail"
import { InlineCreateCardControl, InlineCreateTagControl } from "@/components/budget/inline-create-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ApiError } from "@/lib/api/client"
import { getCurrentMonthKey, parseMonthKey } from "@/lib/date-filters"
import type { Card as CardType, RecurringBillingType, RecurringExpense, Tag } from "@/lib/api/types"
import { formatCurrency, getCategoryColorClass } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"
import { getRecurringDisplayStatus, getRecurringDisplayStatusLabel } from "../_lib/recurring-status"
import {
  formatBillingSchedulePreview,
  formatScheduledChangePreview,
  getNextScheduledVersion,
  getOccurrenceStatusLabel,
  getRecurringOccurrenceStatus,
} from "../_lib/recurring-series"
import {
  categoryConfig,
  emptyForm,
  formatAddedMonth,
  formatBillingSchedule,
  formatProjectedDate,
  formatProjectedDateLong,
  formatRecurringAmount,
  isValidBillingDay,
  isValidRecurringAmount,
  monthPickerMonths,
  monthValueFromParts,
  type RecurringFormState,
} from "../_lib/recurring"

interface MonthPickerProps {
  id?: string
  value: string
  onChange: (next: string) => void
  placeholder: string
  className?: string
  allowClear?: boolean
  disabled?: boolean
}

export function MonthPicker({
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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selectedMonth) {
      setVisibleYear(selectedMonth.getFullYear())
    }
  }, [selectedMonth])

  return (
    <div className="space-y-1">
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-label={`Select month. Current selection: ${displayLabel}`}
        className={cn("h-10 justify-start rounded-xl text-left font-normal", !selectedMonth && "text-muted-foreground", className)}
        onClick={() => setOpen(true)}
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{displayLabel}</span>
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Select month"
        description="Choose which month to view."
        mobileSize="compact"
        desktopClassName="sm:w-[min(calc(100dvw-2rem),22rem)] sm:max-w-[22rem]"
        bodyClassName="px-4 py-4 sm:px-5 sm:py-5"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" aria-label="Previous year" onClick={() => setVisibleYear((year) => year - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold">{visibleYear}</p>
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" aria-label="Next year" onClick={() => setVisibleYear((year) => year + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {monthPickerMonths.map((monthOption) => {
              const monthValue = monthValueFromParts(visibleYear, monthOption.index)
              const isSelected = value === monthValue
              const isCurrent = currentMonthValue === monthValue

              return (
                <button
                  key={monthValue}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(monthValue)
                    setOpen(false)
                  }}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium transition-colors",
                    isSelected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/60 bg-muted/20 text-foreground hover:bg-muted/60",
                    isCurrent && !isSelected && "border-primary/40"
                  )}
                >
                  {monthOption.label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-xl text-sm text-muted-foreground"
              onClick={() => {
                const currentMonth = parseMonthKey(currentMonthValue)
                setVisibleYear(currentMonth?.getFullYear() ?? new Date().getFullYear())
                onChange(currentMonthValue)
                setOpen(false)
              }}
            >
              Current month
            </Button>
            {allowClear && value ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl text-sm text-muted-foreground"
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </ResponsiveDialog>
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

function cardChipLabel(card: CardType): ReactNode {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span>{card.name.trim().replace(/\s+/g, " ")}</span>
      {card.is_favorite && <Star className="h-3 w-3 fill-amber-400 text-amber-500" />}
    </span>
  )
}

export function RecurringForm({
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
                      isSelected ? `border-primary ${config.selectedClassName} text-foreground shadow-sm` : "bg-muted/60 text-foreground hover:bg-muted"
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
                    label: cardChipLabel(card),
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
              <Select value={form.billing_type} onValueChange={(value) => onChange({ ...form, billing_type: value as RecurringBillingType })}>
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
              <MonthPicker value={form.starts_month} onChange={(value) => onChange({ ...form, starts_month: value })} placeholder="Select month" className="w-full" />
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-sm">Ends</Label>
              <MonthPicker value={form.ends_month} onChange={(value) => onChange({ ...form, ends_month: value })} placeholder="No end month" className="w-full" allowClear />
            </div>
          </div>
        </FormSection>

        <FormSection title="Status">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
            <div>
              <Label className="text-sm">Active</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Active recurring expenses are added for eligible months.</p>
            </div>
            <Switch aria-label="Recurring expense active" checked={form.is_active} onCheckedChange={(checked) => onChange({ ...form, is_active: checked })} />
          </div>
        </FormSection>

        {inlineError && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {inlineError}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/50 bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur sm:px-6 sm:pb-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:justify-end">
          <Button variant="ghost" className="h-12 rounded-xl px-4 sm:h-10" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className={cn("h-12 rounded-xl text-base font-semibold sm:h-10 sm:text-sm", !canSubmit && "bg-muted text-muted-foreground shadow-none hover:bg-muted hover:text-muted-foreground")}
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

interface RecurringDetailDialogProps {
  item: RecurringExpense | null
  selectedMonth: string
  seriesItems: RecurringExpense[]
  isSeriesLoading: boolean
  mode: "details" | "schedule_change"
  scheduleChangeAmount: string
  scheduleChangeEffectiveMonth: string
  scheduleChangeBillingType: RecurringBillingType
  scheduleChangeBillingDay: string
  isMutating: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onScheduleChangeAmountChange: (value: string) => void
  onScheduleChangeEffectiveMonthChange: (value: string) => void
  onScheduleChangeBillingTypeChange: (value: RecurringBillingType) => void
  onScheduleChangeBillingDayChange: (value: string) => void
  onScheduleChangeBack: () => void
  onScheduleChangeSubmit: () => void
  onEdit: (item: RecurringExpense) => void
  onScheduleChange: (item: RecurringExpense) => void
  onCancelScheduledChange: (item: RecurringExpense) => void
  onDelete: (item: RecurringExpense) => void
}

export function RecurringItemRow({
  item,
  subtitle,
  showScheduledChange = false,
  onOpen,
}: {
  item: RecurringExpense
  subtitle: string
  showScheduledChange?: boolean
  onOpen: () => void
}) {
  const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)

  return (
    <button
      type="button"
      className="group grid w-full cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)_auto_1rem] items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-5"
      aria-label={`Open details for ${item.expense}`}
      onClick={onOpen}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", getCategoryColorClass(item.category))}>
        <TagIcon className="h-5 w-5 text-white" />
      </div>

      <div className="min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="truncate text-sm font-semibold sm:text-[15px]">{item.expense}</p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
        {showScheduledChange ? (
          <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">Scheduled change ahead</p>
        ) : null}
      </div>

      <div className="min-w-[4.25rem] shrink-0 text-right sm:min-w-[4.75rem]">
        <p className="whitespace-nowrap text-sm font-semibold">{formatCurrency(item.amount)}</p>
      </div>

      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" />
    </button>
  )
}

export function RecurringDetailDialog({
  item,
  selectedMonth,
  seriesItems,
  isSeriesLoading,
  mode,
  scheduleChangeAmount,
  scheduleChangeEffectiveMonth,
  scheduleChangeBillingType,
  scheduleChangeBillingDay,
  isMutating,
  open,
  onOpenChange,
  onScheduleChangeAmountChange,
  onScheduleChangeEffectiveMonthChange,
  onScheduleChangeBillingTypeChange,
  onScheduleChangeBillingDayChange,
  onScheduleChangeBack,
  onScheduleChangeSubmit,
  onEdit,
  onScheduleChange,
  onCancelScheduledChange,
  onDelete,
}: RecurringDetailDialogProps) {
  if (!item) {
    return null
  }

  const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)
  const status = getRecurringDisplayStatus(item, selectedMonth)
  const currentVersionDetail = item.ends_month ? `Active through ${formatAddedMonth(item.ends_month)}` : "Active with no end month"
  const nextScheduledItem = getNextScheduledVersion(seriesItems, selectedMonth)
  const occurrenceStatus = getRecurringOccurrenceStatus(item, selectedMonth)
  const schedulePreview = formatScheduledChangePreview(item, {
    amount: formatRecurringAmount(scheduleChangeAmount || item.amount),
    effectiveMonth: scheduleChangeEffectiveMonth,
    billingType: scheduleChangeBillingType,
    billingDay: scheduleChangeBillingType === "last_day" ? null : Number.parseInt(scheduleChangeBillingDay || "1", 10) || 1,
  })
  const title = mode === "schedule_change" ? "Schedule change" : item.expense
  const description = mode === "schedule_change"
    ? `${item.expense} is currently ${formatCurrency(item.amount)} and ${formatBillingSchedulePreview(item.billing_type, item.billing_day)}.`
    : `${formatCurrency(item.amount)} / month`

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      mobileSize="compact"
      desktopClassName="sm:w-[min(calc(100dvw-2rem),44rem)] sm:max-w-[44rem]"
      headerClassName="px-4 pb-3 pt-2 sm:px-7 sm:pb-4 sm:pt-5"
      bodyClassName="px-4 py-4 sm:px-7 sm:py-6"
      footerClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7 sm:pt-4 sm:pb-6"
      headerAccessory={mode === "schedule_change" ? (
        <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-sm" onClick={onScheduleChangeBack}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      ) : undefined}
      footer={
        mode === "schedule_change" ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:justify-end">
            <Button type="button" variant="ghost" className="h-11 rounded-xl px-4" onClick={onScheduleChangeBack}>
              Cancel
            </Button>
            <Button type="button" className="h-11 rounded-xl" onClick={onScheduleChangeSubmit} disabled={isMutating}>
              {isMutating ? "Scheduling..." : "Schedule change"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" className="h-11 w-full rounded-xl sm:h-12" onClick={() => onScheduleChange(item)} disabled={nextScheduledItem !== null}>
              {nextScheduledItem ? "Change already scheduled" : "Schedule change"}
            </Button>
            {nextScheduledItem ? (
              <p className="text-center text-xs text-muted-foreground">
                A change is already scheduled for {formatAddedMonth(nextScheduledItem.starts_month)}.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="order-2 h-11 rounded-xl sm:h-12" onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4" />
                Edit current version
              </Button>
              <Button type="button" variant="outline" className="order-1 h-11 rounded-xl text-destructive hover:text-destructive sm:h-12" onClick={() => onDelete(item)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        )
      }
    >
      {mode === "schedule_change" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create a new version starting in {formatAddedMonth(scheduleChangeEffectiveMonth)}.
          </p>

          <div className="space-y-2">
            <Label htmlFor="schedule-change-amount" className="text-sm font-medium">New amount</Label>
            <AmountInput
              id="schedule-change-amount"
              name="schedule_change_amount"
              value={scheduleChangeAmount}
              onValueChange={onScheduleChangeAmountChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-change-month" className="text-sm font-medium">Effective month</Label>
            <MonthPicker
              id="schedule-change-month"
              value={scheduleChangeEffectiveMonth}
              onChange={onScheduleChangeEffectiveMonthChange}
              placeholder="Select month"
              className="w-full"
            />
          </div>

          <div className="grid min-w-0 max-w-full grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label className="text-sm">Charge schedule</Label>
              <Select value={scheduleChangeBillingType} onValueChange={(value) => onScheduleChangeBillingTypeChange(value as RecurringBillingType)}>
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
                value={scheduleChangeBillingType === "last_day" ? "" : scheduleChangeBillingDay}
                onChange={(event) => onScheduleChangeBillingDayChange(event.target.value)}
                disabled={scheduleChangeBillingType === "last_day"}
                placeholder={scheduleChangeBillingType === "last_day" ? "Auto" : "1-31"}
                inputMode="numeric"
                className="h-10 rounded-xl border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <p className="mt-2 text-sm text-muted-foreground">{schedulePreview}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary sm:h-14 sm:w-14">
              <TagIcon className="h-5 w-5 text-foreground sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">Current version</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCurrency(item.amount)} · {formatBillingSchedule(item)} · {currentVersionDetail}
              </p>
            </div>
          </div>

          {nextScheduledItem ? (
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-3 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Scheduled change</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatCurrency(nextScheduledItem.amount)} · Starts {formatAddedMonth(nextScheduledItem.starts_month)} · {formatBillingSchedule(nextScheduledItem)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" className="h-9 rounded-xl px-3 text-xs" onClick={() => onEdit(nextScheduledItem)}>
                    Edit
                  </Button>
                  <Button type="button" variant="outline" className="h-9 rounded-xl px-3 text-xs text-destructive hover:text-destructive" onClick={() => onCancelScheduledChange(nextScheduledItem)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl bg-secondary/50 p-3 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <DetailRow className="col-span-2" icon={<CalendarIcon className="h-5 w-5 text-muted-foreground" />} label="Schedule" value={formatBillingSchedule(item)} detail={`Next: ${formatProjectedDateLong(item.projected_date_for_month)}`} />
              <DetailRow icon={<Folder className="h-5 w-5 text-muted-foreground" />} label="Category" value={categoryConfig[item.category].label} />
              <DetailRow icon={<TagGlyph className="h-5 w-5 text-muted-foreground" />} label="Tag" value={item.tag.name} />
              <DetailRow icon={<CreditCard className="h-5 w-5 text-muted-foreground" />} label="Card" value={item.card?.name ?? "No card"} />
              <DetailRow icon={<Repeat className="h-5 w-5 text-muted-foreground" />} label="Status this month" value={getOccurrenceStatusLabel(occurrenceStatus)} detail={getRecurringDisplayStatusLabel(status)} />
              <DetailRow className="col-span-2" icon={<CalendarIcon className="h-5 w-5 text-muted-foreground" />} label="Active months" value={`Starts ${formatAddedMonth(item.starts_month)}`} detail={item.ends_month ? `Ends ${formatAddedMonth(item.ends_month)}` : "No end month"} />
            </div>
          </div>

          {(isSeriesLoading || seriesItems.length > 1) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">History</h3>
              {isSeriesLoading ? (
                <p className="text-sm text-muted-foreground">Loading price history…</p>
              ) : (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-3">
                  {seriesItems.map((seriesItem) => (
                    <p key={seriesItem.id} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{formatCurrency(seriesItem.amount)}</span>
                      {" · "}
                      {formatAddedMonth(seriesItem.starts_month)}
                      {" – "}
                      {seriesItem.ends_month ? formatAddedMonth(seriesItem.ends_month) : "Present"}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
