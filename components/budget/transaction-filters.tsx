"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { format } from "date-fns"
import { Calendar as AppCalendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CalendarIcon, ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react"
import type { Card, Category, Context, Preset, SplitFilter, Tag } from "@/lib/api/types"
import { formatDateValue, parseIsoDate, transactionFilterPresets } from "@/lib/date-filters"
import { getContextIcon, getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import { mobileDrawerHandleClassName } from "@/lib/mobile-drawer"

interface TransactionFiltersProps {
  preset: Preset | "all"
  onPresetChange: (preset: Preset | "all") => void
  selectedCategories: Category[]
  onCategoriesChange: (categories: Category[]) => void
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  selectedContexts: string[]
  onContextsChange: (contexts: string[]) => void
  selectedCards: string[]
  onCardsChange: (cards: string[]) => void
  tags: Tag[]
  contexts: Context[]
  quickPickTags?: Tag[]
  cards: Card[]
  searchQuery: string
  onSearchChange: (query: string) => void
  splitFilter: SplitFilter
  onSplitFilterChange: (value: SplitFilter) => void
  monthFilterLabel?: string | null
  onClearMonthFilter?: () => void
  customDateRange?: { date_from: string; date_to: string } | null
  onCustomDateRangeChange: (range: { date_from: string; date_to: string } | null) => void
  desktopSidebarToggle?: ReactNode
  desktopMode?: boolean
}

const categories: { value: Category; label: string }[] = [
  { value: "needs", label: "Needs" },
  { value: "wants", label: "Wants" },
  { value: "savings", label: "Savings" },
]

const datePresetOrder: Preset[] = ["month_to_date", "last_30_days", "last_7_days", "last_month"]
const datePresets: { value: Preset; label: string }[] = datePresetOrder.flatMap((value) => {
  const preset = transactionFilterPresets.find((item) => item.value === value)
  return preset && preset.value !== "all" ? [{ value: preset.value, label: preset.label }] : []
})

function ShortcutRail({ items }: { items: { key: string; label: string; onClick: () => void }[] }) {
  return (
    <div className="min-w-0 overflow-x-auto overscroll-x-contain pr-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full border border-border/70 bg-background px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChoiceChip({
  selected,
  label,
  onClick,
  className,
}: {
  selected: boolean
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        className
      )}
    >
      {label}
    </button>
  )
}

function FilterSectionHeader({
  title,
  meta,
  action,
}: {
  title: string
  meta?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="mb-3 flex min-h-7 items-center justify-between gap-3">
      <h3 className="font-semibold">{title}{meta && <span className="ml-2 text-xs font-normal text-muted-foreground">{meta}</span>}</h3>
      {action && (
        <button type="button" onClick={action.onClick} className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          {action.label}
        </button>
      )}
    </div>
  )
}

function TagIconPreview({ tag }: { tag: Tag }) {
  const Icon = getTagIcon(tag.name, tag.icon_key)
  return <Icon aria-hidden="true" className="h-3.5 w-3.5" />
}

function ContextIconPreview({ context }: { context: Context }) {
  const Icon = getContextIcon(context.name, context.icon_key)
  return <Icon aria-hidden="true" className="h-3.5 w-3.5" />
}

function CompactFilterSection({
  label,
  options,
  selectedValues,
  onToggle,
  collapsedLimit = 4,
}: {
  label: string
  options: { value: string; label: string; icon?: ReactNode }[]
  selectedValues: string[]
  onToggle: (value: string) => void
  collapsedLimit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const selected = options.filter((option) => selectedValues.includes(option.value))
  const unselected = options.filter((option) => !selectedValues.includes(option.value))
  const orderedOptions = [...selected, ...unselected]
  const visibleOptions = showAll ? orderedOptions : orderedOptions.slice(0, Math.max(collapsedLimit, selected.length))
  const hiddenCount = Math.max(orderedOptions.length - visibleOptions.length, 0)
  const selectedSummary = selected.length === 0
    ? "All"
    : selected.length <= 2
      ? selected.map((option) => option.label).join(", ")
      : `${selected.slice(0, 2).map((option) => option.label).join(", ")} +${selected.length - 2}`

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {selected.length > 0 && <span className="text-[10px] font-medium text-muted-foreground">{selected.length}</span>}
      </div>
      {options.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">No {label.toLocaleLowerCase()} yet</p>
      ) : (
        <div className="grid gap-0.5">
          {!expanded ? (
            <button
              type="button"
              aria-expanded={false}
              onClick={() => { setShowAll(false); setExpanded(true) }}
              className="flex min-h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {selected[0]?.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">{selected[0].icon}</span>}
              <span className="min-w-0 flex-1 truncate" title={selectedSummary}>{selectedSummary}</span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ) : (
            <>
              {visibleOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onToggle(option.value)}
                    className={cn(
                      "flex min-h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      isSelected && "bg-primary/10 font-medium text-foreground"
                    )}
                  >
                    {option.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">{option.icon}</span>}
                    <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
                    {isSelected && <span aria-hidden="true" className="shrink-0 text-primary">✓</span>}
                  </button>
                )
              })}
              {(hiddenCount > 0 || visibleOptions.length > 0) && (
                <button
                  type="button"
                  aria-expanded={true}
                  onClick={() => {
                    if (hiddenCount > 0) {
                      setShowAll(true)
                    } else {
                      setShowAll(false)
                      setExpanded(false)
                    }
                  }}
                  className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {hiddenCount > 0 ? `Show ${hiddenCount} more` : "Show less"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function FilterChoiceGroup({
  items,
  selected,
  onToggle,
}: {
  items: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((item) => (
        <ChoiceChip key={item.value} label={item.label} selected={selected.includes(item.value)} onClick={() => onToggle(item.value)} />
      ))}
    </div>
  )
}

export function TransactionFilters({
  preset,
  onPresetChange,
  selectedCategories,
  onCategoriesChange,
  selectedTags,
  onTagsChange,
  selectedContexts,
  onContextsChange,
  selectedCards,
  onCardsChange,
  tags,
  contexts,
  quickPickTags = [],
  cards,
  searchQuery,
  onSearchChange,
  splitFilter,
  onSplitFilterChange,
  monthFilterLabel,
  onClearMonthFilter,
  customDateRange,
  onCustomDateRangeChange,
  desktopSidebarToggle,
  desktopMode = false,
}: TransactionFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [customRangeExpanded, setCustomRangeExpanded] = useState(Boolean(customDateRange))
  const [customFrom, setCustomFrom] = useState(customDateRange?.date_from ?? "")
  const [customTo, setCustomTo] = useState(customDateRange?.date_to ?? "")
  const [customRangeError, setCustomRangeError] = useState<string | null>(null)
  const [cardsExpanded, setCardsExpanded] = useState(selectedCards.length > 0)
  const filtersScrollRef = useRef<HTMLDivElement>(null)
  const filtersSwipeDismiss = useSwipeDismiss({
    open: filtersOpen,
    onDismiss: () => setFiltersOpen(false),
    scrollRef: filtersScrollRef,
  })

  useEffect(() => {
    setCustomFrom(customDateRange?.date_from ?? "")
    setCustomTo(customDateRange?.date_to ?? "")
    setCustomRangeError(null)
    if (customDateRange) {
      setCustomRangeExpanded(true)
    }
  }, [customDateRange?.date_from, customDateRange?.date_to])

  useEffect(() => {
    if (selectedCards.length > 0) {
      setCardsExpanded(true)
    }
  }, [selectedCards.length])

  const activeFiltersCount =
    (monthFilterLabel ? 1 : 0) +
    (customDateRange && !monthFilterLabel ? 1 : 0) +
    (preset !== "all" ? 1 : 0) +
    selectedCategories.length +
    selectedTags.length +
    selectedContexts.length +
    selectedCards.length +
    (splitFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)
  const hasClearableFilters = Boolean(
    monthFilterLabel || customDateRange || preset !== "all" || selectedCategories.length || selectedTags.length || selectedContexts.length || selectedCards.length || splitFilter !== "all"
  )
  const selectedPresetLabel = preset !== "all"
    ? transactionFilterPresets.find((item) => item.value === preset)?.label
    : null
  const dateIsActive = Boolean(monthFilterLabel || customDateRange || preset !== "all")
  const toggleValue = <T,>(value: T, values: T[], change: (next: T[]) => void) => {
    change(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  const clearAllFilters = () => {
    onPresetChange("all")
    onCustomDateRangeChange(null)
    if (monthFilterLabel) {
      onClearMonthFilter?.()
    }
    onCategoriesChange([])
    onTagsChange([])
    onContextsChange([])
    onCardsChange([])
    onSplitFilterChange("all")
  }

  const clearDate = () => {
    setCustomFrom("")
    setCustomTo("")
    setCustomRangeError(null)
    setCustomRangeExpanded(false)
    onPresetChange("all")
    onCustomDateRangeChange(null)
    if (monthFilterLabel) {
      onClearMonthFilter?.()
    }
  }

  const selectPreset = (nextPreset: Preset) => {
    setCustomRangeExpanded(false)
    setCustomRangeError(null)
    onPresetChange(nextPreset)
    onCustomDateRangeChange(null)
  }

  const applyCustomDateRange = () => {
    const from = parseIsoDate(customFrom)
    const to = parseIsoDate(customTo)
    if (!from || !to) {
      setCustomRangeError("Select both a start and end date.")
      return
    }
    if (customFrom > customTo) {
      setCustomRangeError("Start date must be before or equal to end date.")
      return
    }
    setCustomRangeError(null)
    onCustomDateRangeChange({ date_from: customFrom, date_to: customTo })
  }

  const selectedFromDate = parseIsoDate(customFrom)
  const selectedToDate = parseIsoDate(customTo)
  const dateChip = monthFilterLabel ?? (
    customDateRange
      ? `${formatDateValue(customDateRange.date_from, { month: "short", day: "numeric" })}–${formatDateValue(customDateRange.date_to, { month: "short", day: "numeric", year: "numeric" })}`
      : selectedPresetLabel
  )

  const shortcuts = [
    ...(preset !== "month_to_date" && !monthFilterLabel && !customDateRange
      ? [{ key: "month", label: "This Month", onClick: () => selectPreset("month_to_date") }]
      : []),
    ...(preset !== "last_30_days" && !customDateRange
      ? [{ key: "30", label: "Last 30 Days", onClick: () => selectPreset("last_30_days") }]
      : []),
    ...(splitFilter !== "split"
      ? [{ key: "split", label: "Split", onClick: () => onSplitFilterChange("split") }]
      : []),
    ...categories
      .filter((category) => !selectedCategories.includes(category.value))
      .map((category) => ({
        key: category.value,
        label: category.label,
        onClick: () => toggleValue(category.value, selectedCategories, onCategoriesChange),
      })),
    ...quickPickTags
      .filter((tag) => !selectedTags.includes(tag.id))
      .map((tag) => ({
        key: `tag-${tag.id}`,
        label: tag.name,
        onClick: () => toggleValue(tag.id, selectedTags, onTagsChange),
      })),
  ]

  const activeChips = [
    ...(dateChip ? [{ key: "date", label: dateChip, onClick: clearDate }] : []),
    ...selectedCategories.map((value) => ({
      key: value,
      label: categories.find((item) => item.value === value)?.label ?? value,
      onClick: () => onCategoriesChange(selectedCategories.filter((item) => item !== value)),
    })),
    ...selectedTags.map((id) => ({
      key: `tag-${id}`,
      label: tags.find((tag) => tag.id === id)?.name ?? "Tag",
      onClick: () => onTagsChange(selectedTags.filter((value) => value !== id)),
    })),
    ...selectedContexts.map((id) => ({
      key: `context-${id}`,
      label: contexts.find((context) => context.id === id)?.name ?? "Context",
      onClick: () => onContextsChange(selectedContexts.filter((value) => value !== id)),
    })),
    ...selectedCards.map((id) => ({
      key: `card-${id}`,
      label: cards.find((card) => card.id === id)?.name ?? "Card",
      onClick: () => onCardsChange(selectedCards.filter((value) => value !== id)),
    })),
    ...(splitFilter !== "all"
      ? [{ key: "split", label: splitFilter === "split" ? "Split" : "Not Split", onClick: () => onSplitFilterChange("all") }]
      : []),
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {desktopSidebarToggle && <div className="hidden shrink-0 lg:flex">{desktopSidebarToggle}</div>}
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-11 rounded-xl pl-9"
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" aria-label="Clear search">
              <X className="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className={cn("flex min-w-0 items-center gap-2", desktopMode && "hidden")}>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-10 shrink-0 rounded-full border border-border/70 bg-background px-2.5 text-muted-foreground hover:border-border hover:text-foreground">
              <SlidersHorizontal className="mr-1 size-4" aria-hidden="true" />
              Filters
              {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">{activeFiltersCount}</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent {...filtersSwipeDismiss} side="bottom" className="h-[85vh] gap-0 rounded-t-3xl p-0 lg:h-auto lg:max-h-[75vh]">
            <SheetHeader className="border-b border-border/50 px-6 pb-4 pt-6">
              <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "-mt-2 mb-4 lg:hidden")} aria-hidden="true" />
              <SheetTitle className="text-xl">Filters</SheetTitle>
            </SheetHeader>

            <div ref={filtersScrollRef} className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <section>
                <FilterSectionHeader title="Date" action={dateIsActive ? { label: "Clear", onClick: clearDate } : undefined} />
                <div className="flex flex-wrap gap-2.5">
                  {datePresets.map((item) => (
                    <ChoiceChip key={item.value} label={item.label} selected={preset === item.value && !customDateRange} onClick={() => selectPreset(item.value)} />
                  ))}
                  <ChoiceChip
                    label="Custom range"
                    selected={customRangeExpanded || Boolean(customDateRange)}
                    onClick={() => setCustomRangeExpanded((expanded) => !expanded)}
                  />
                </div>

                {customRangeExpanded && (
                  <div id="transaction-custom-range" className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label htmlFor="transaction-date-from" className="text-xs font-medium text-muted-foreground">From</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button id="transaction-date-from" type="button" variant="outline" className="h-10 w-full justify-start rounded-xl text-left font-normal">
                              <CalendarIcon className="mr-2 size-4 text-muted-foreground" aria-hidden="true" />
                              {selectedFromDate ? format(selectedFromDate, "MMM d, yyyy") : "Select start date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <AppCalendar mode="single" selected={selectedFromDate ?? undefined} onSelect={(value) => value && setCustomFrom(format(value, "yyyy-MM-dd"))} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="transaction-date-to" className="text-xs font-medium text-muted-foreground">To</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button id="transaction-date-to" type="button" variant="outline" className="h-10 w-full justify-start rounded-xl text-left font-normal">
                              <CalendarIcon className="mr-2 size-4 text-muted-foreground" aria-hidden="true" />
                              {selectedToDate ? format(selectedToDate, "MMM d, yyyy") : "Select end date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <AppCalendar mode="single" selected={selectedToDate ?? undefined} onSelect={(value) => value && setCustomTo(format(value, "yyyy-MM-dd"))} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    {customRangeError && <p className="text-xs text-destructive" role="alert">{customRangeError}</p>}
                    <Button type="button" size="sm" className="rounded-full" disabled={!customFrom || !customTo} onClick={applyCustomDateRange}>Set range</Button>
                  </div>
                )}
              </section>

              <section>
                <FilterSectionHeader title="Category" />
                <FilterChoiceGroup items={categories} selected={selectedCategories} onToggle={(value) => toggleValue(value as Category, selectedCategories, onCategoriesChange)} />
              </section>

              <section>
                <FilterSectionHeader title="Tags" meta={selectedTags.length ? `${selectedTags.length} selected` : undefined} />
                <FilterChoiceGroup items={tags.map((tag) => ({ value: tag.id, label: tag.name }))} selected={selectedTags} onToggle={(value) => toggleValue(value, selectedTags, onTagsChange)} />
              </section>

              <section>
                <FilterSectionHeader title="Contexts" meta={selectedContexts.length ? `${selectedContexts.length} selected` : undefined} />
                <FilterChoiceGroup items={contexts.map((context) => ({ value: context.id, label: context.name }))} selected={selectedContexts} onToggle={(value) => toggleValue(value, selectedContexts, onContextsChange)} />
              </section>

              <section>
                <FilterSectionHeader title="Split" />
                <FilterChoiceGroup
                  items={[{ value: "split", label: "Split" }, { value: "not_split", label: "Not Split" }]}
                  selected={splitFilter === "all" ? [] : [splitFilter]}
                  onToggle={(value) => onSplitFilterChange(splitFilter === value ? "all" : value as SplitFilter)}
                />
              </section>

              <section>
                <button
                  type="button"
                  aria-expanded={cardsExpanded}
                  aria-controls="transaction-filter-cards"
                  onClick={() => setCardsExpanded((expanded) => !expanded)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-left"
                >
                  <span className="font-semibold">Cards{selectedCards.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedCards.length} selected</span>}</span>
                  <ChevronRight className={cn("size-4 shrink-0 transition-transform", cardsExpanded && "rotate-90")} aria-hidden="true" />
                </button>
                {cardsExpanded && <div id="transaction-filter-cards" className="mt-3"><FilterChoiceGroup items={cards.map((card) => ({ value: card.id, label: card.name }))} selected={selectedCards} onToggle={(value) => toggleValue(value, selectedCards, onCardsChange)} /></div>}
              </section>
            </div>

            <SheetFooter className="sticky bottom-0 flex-row items-center justify-between border-t border-border/50 bg-background px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              <Button type="button" variant="ghost" disabled={!hasClearableFilters} onClick={clearAllFilters}>Clear all</Button>
              <Button type="button" onClick={() => setFiltersOpen(false)}>Done</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <ShortcutRail items={shortcuts} />
      </div>

      {desktopMode && (
        <div className="space-y-5">
          <section className="space-y-2">
            <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date</p>
            <div className="grid gap-1">
              {datePresets.slice(0, 2).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => selectPreset(item.value)}
                  className={cn(
                    "flex min-h-9 items-center rounded-lg px-2 text-left text-sm transition-colors hover:bg-muted/60",
                    preset === item.value && !customDateRange && "bg-secondary font-medium text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setCustomRangeExpanded(true); setFiltersOpen(true) }}
                className={cn(
                  "flex min-h-9 items-center rounded-lg px-2 text-left text-sm transition-colors hover:bg-muted/60",
                  customDateRange && "bg-secondary font-medium text-foreground"
                )}
              >
                Custom range
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Filters</p>
              {hasClearableFilters && <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-muted-foreground hover:text-foreground">Clear</button>}
            </div>
            <div className="space-y-5">
              <section className="space-y-2">
                <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Category</p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {categories.map((category) => (
                    <ChoiceChip
                      key={category.value}
                      label={category.label}
                      selected={selectedCategories.includes(category.value)}
                      onClick={() => toggleValue(category.value, selectedCategories, onCategoriesChange)}
                      className="min-h-8 px-2.5 py-1 text-xs"
                    />
                  ))}
                </div>
              </section>

              <CompactFilterSection
                label="Tags"
                options={tags.map((tag) => ({ value: tag.id, label: tag.name, icon: <TagIconPreview tag={tag} /> }))}
                selectedValues={selectedTags}
                onToggle={(value) => toggleValue(value, selectedTags, onTagsChange)}
                collapsedLimit={8}
              />
              <CompactFilterSection
                label="Contexts"
                options={contexts.map((context) => ({
                  value: context.id,
                  label: context.name,
                  icon: <ContextIconPreview context={context} />,
                }))}
                selectedValues={selectedContexts}
                onToggle={(value) => toggleValue(value, selectedContexts, onContextsChange)}
                collapsedLimit={8}
              />
              <CompactFilterSection
                label="Cards"
                options={cards.map((card) => ({ value: card.id, label: card.name }))}
                selectedValues={selectedCards}
                onToggle={(value) => toggleValue(value, selectedCards, onCardsChange)}
                collapsedLimit={8}
              />

              <section className="space-y-2">
                <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Split</p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {[{ value: "all", label: "All" }, { value: "split", label: "Split" }, { value: "not_split", label: "Not split" }].map((item) => (
                    <ChoiceChip
                      key={item.value}
                      label={item.label}
                      selected={splitFilter === item.value}
                      onClick={() => onSplitFilterChange(item.value === "all" ? "all" : item.value as SplitFilter)}
                      className="min-h-8 px-2.5 py-1 text-xs"
                    />
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {!desktopMode && activeChips.length > 0 && (
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeChips.map((chip) => (
              <button key={chip.key} type="button" onClick={chip.onClick} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground">
                <span>{chip.label}</span>
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
          {activeFiltersCount >= 2 && <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 shrink-0 px-1 text-xs text-muted-foreground">Clear all</Button>}
        </div>
      )}
    </div>
  )
}
