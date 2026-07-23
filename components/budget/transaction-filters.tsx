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
import type { Card, Category, Preset, SplitFilter, Tag } from "@/lib/api/types"
import { formatDateValue, parseIsoDate, transactionFilterPresets } from "@/lib/date-filters"
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
  selectedCards: string[]
  onCardsChange: (cards: string[]) => void
  tags: Tag[]
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
}

const categories: { value: Category; label: string }[] = [
  { value: "needs", label: "Needs" },
  { value: "wants", label: "Wants" },
  { value: "savings", label: "Savings" },
]

function ShortcutRail({ items }: { items: { key: string; label: string; onClick: () => void }[] }) {
  return (
    <div className="min-w-0 overflow-x-auto overscroll-x-contain pr-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground whitespace-nowrap transition-colors hover:border-border hover:text-foreground"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChoiceChip({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
        selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      )}
    >
      {label}
    </button>
  )
}

export function TransactionFilters({
  preset, onPresetChange, selectedCategories, onCategoriesChange, selectedTags, onTagsChange,
  selectedCards, onCardsChange, tags, quickPickTags = [], cards, searchQuery, onSearchChange,
  splitFilter, onSplitFilterChange, monthFilterLabel, onClearMonthFilter, customDateRange,
  onCustomDateRangeChange, desktopSidebarToggle,
}: TransactionFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(customDateRange?.date_from ?? "")
  const [customTo, setCustomTo] = useState(customDateRange?.date_to ?? "")
  const [customRangeError, setCustomRangeError] = useState<string | null>(null)
  const [cardsExpanded, setCardsExpanded] = useState(false)
  const filtersScrollRef = useRef<HTMLDivElement>(null)
  const filtersSwipeDismiss = useSwipeDismiss({ open: filtersOpen, onDismiss: () => setFiltersOpen(false), scrollRef: filtersScrollRef })

  useEffect(() => {
    setCustomFrom(customDateRange?.date_from ?? "")
    setCustomTo(customDateRange?.date_to ?? "")
    setCustomRangeError(null)
  }, [customDateRange?.date_from, customDateRange?.date_to])

  const activeFiltersCount = (monthFilterLabel ? 1 : 0) + (customDateRange && !monthFilterLabel ? 1 : 0) +
    (preset !== "all" ? 1 : 0) + selectedCategories.length + selectedTags.length + selectedCards.length + (splitFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)
  const selectedPresetLabel = preset !== "all" ? transactionFilterPresets.find((item) => item.value === preset)?.label : null
  const toggle = <T,>(value: T, values: T[], change: (next: T[]) => void) =>
    change(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])

  const clearFilters = () => {
    onPresetChange("all")
    onCustomDateRangeChange(null)
    onClearMonthFilter?.()
    onCategoriesChange([])
    onTagsChange([])
    onCardsChange([])
    onSplitFilterChange("all")
  }
  const applyCustomDateRange = () => {
    if (!customFrom || !customTo) return setCustomRangeError("Select both a start and end date.")
    if (customFrom > customTo) return setCustomRangeError("Start date must be before or equal to end date.")
    setCustomRangeError(null)
    onCustomDateRangeChange({ date_from: customFrom, date_to: customTo })
  }
  const clearDate = () => {
    setCustomFrom(""); setCustomTo(""); setCustomRangeError(null); onPresetChange("all"); onCustomDateRangeChange(null); onClearMonthFilter?.()
  }
  const removeTag = (id: string) => onTagsChange(selectedTags.filter((value) => value !== id))
  const removeCategory = (value: Category) => onCategoriesChange(selectedCategories.filter((item) => item !== value))
  const removeCard = (id: string) => onCardsChange(selectedCards.filter((value) => value !== id))
  const dateChip = monthFilterLabel ?? (customDateRange ? `${formatDateValue(customDateRange.date_from, { month: "short", day: "numeric" })}–${formatDateValue(customDateRange.date_to, { month: "short", day: "numeric", year: "numeric" })}` : selectedPresetLabel)

  const shortcuts = [
    ...(preset !== "month_to_date" && !monthFilterLabel && !customDateRange ? [{ key: "month", label: "This Month", onClick: () => { onPresetChange("month_to_date"); onCustomDateRangeChange(null) } }] : []),
    ...(preset !== "last_30_days" && !customDateRange ? [{ key: "30", label: "Last 30 Days", onClick: () => { onPresetChange("last_30_days"); onCustomDateRangeChange(null) } }] : []),
    ...(splitFilter !== "split" ? [{ key: "split", label: "Split", onClick: () => onSplitFilterChange("split") }] : []),
    ...categories.filter((category) => !selectedCategories.includes(category.value)).map((category) => ({ key: category.value, label: category.label, onClick: () => toggle(category.value, selectedCategories, onCategoriesChange) })),
    ...quickPickTags.filter((tag) => !selectedTags.includes(tag.id)).map((tag) => ({ key: `tag-${tag.id}`, label: tag.name, onClick: () => toggle(tag.id, selectedTags, onTagsChange) })),
  ]

  const activeChips = [
    ...(dateChip ? [{ key: "date", label: dateChip, onClick: clearDate }] : []),
    ...selectedCategories.map((value) => ({ key: value, label: categories.find((item) => item.value === value)?.label ?? value, onClick: () => removeCategory(value) })),
    ...selectedTags.map((id) => ({ key: `tag-${id}`, label: tags.find((tag) => tag.id === id)?.name ?? "Tag", onClick: () => removeTag(id) })),
    ...selectedCards.map((id) => ({ key: `card-${id}`, label: cards.find((card) => card.id === id)?.name ?? "Card", onClick: () => removeCard(id) })),
    ...(splitFilter !== "all" ? [{ key: "split", label: splitFilter === "split" ? "Split" : "Not Split", onClick: () => onSplitFilterChange("all") }] : []),
  ]

  const selectedFromDate = parseIsoDate(customFrom)
  const selectedToDate = parseIsoDate(customTo)
  const filterChoices = (items: { value: string; label: string }[], selected: string[], change: (next: string[]) => void) => (
    <div className="flex flex-wrap gap-3">{items.map((item) => <ChoiceChip key={item.value} label={item.label} selected={selected.includes(item.value)} onClick={() => toggle(item.value, selected, change)} />)}</div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {desktopSidebarToggle && <div className="hidden shrink-0 lg:flex">{desktopSidebarToggle}</div>}
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} className="h-11 rounded-xl pl-9" />
          {searchQuery && <button type="button" onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"><X className="size-4 text-muted-foreground" /></button>}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-10 shrink-0 rounded-full border border-border/70 bg-background px-2.5 text-muted-foreground hover:border-border hover:text-foreground">
              <SlidersHorizontal className="mr-1 size-4" aria-hidden="true" /> Filters
              {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">{activeFiltersCount}</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent {...filtersSwipeDismiss} side="bottom" className="h-[85vh] rounded-t-3xl p-0 gap-0 lg:h-auto lg:max-h-[75vh]">
            <SheetHeader className="border-b border-border/50 px-6 pb-4 pt-6"><div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "-mt-2 mb-4 lg:hidden")} aria-hidden="true" /><SheetTitle className="text-xl">Filters</SheetTitle></SheetHeader>
            <div ref={filtersScrollRef} className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              <section><h3 className="mb-4 font-semibold">Date</h3><div className="mb-3 flex flex-wrap gap-2">{transactionFilterPresets.filter((item) => item.value !== "all" && item.value !== "quarter_to_date").map((item) => <ChoiceChip key={item.value} label={item.label} selected={preset === item.value && !customDateRange} onClick={() => { onPresetChange(item.value); onCustomDateRangeChange(null) }} />)}</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 justify-start rounded-xl text-left font-normal"><CalendarIcon className="mr-2 size-4 text-muted-foreground" />{selectedFromDate ? format(selectedFromDate, "MMM d, yyyy") : "Select start date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><AppCalendar mode="single" selected={selectedFromDate ?? undefined} onSelect={(value) => value && setCustomFrom(format(value, "yyyy-MM-dd"))} initialFocus /></PopoverContent></Popover><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 justify-start rounded-xl text-left font-normal"><CalendarIcon className="mr-2 size-4 text-muted-foreground" />{selectedToDate ? format(selectedToDate, "MMM d, yyyy") : "Select end date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><AppCalendar mode="single" selected={selectedToDate ?? undefined} onSelect={(value) => value && setCustomTo(format(value, "yyyy-MM-dd"))} initialFocus /></PopoverContent></Popover></div>{customRangeError && <p className="mt-2 text-xs text-destructive">{customRangeError}</p>}<div className="mt-3 flex gap-2"><Button type="button" size="sm" className="rounded-full" disabled={!customFrom || !customTo} onClick={applyCustomDateRange}>Set range</Button><Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={clearDate}>Clear</Button></div></section>
              <section><h3 className="mb-4 font-semibold">Category</h3>{filterChoices(categories, selectedCategories, (next) => onCategoriesChange(next as Category[]))}</section>
              <section><h3 className="mb-4 font-semibold">Tags</h3>{filterChoices(tags.map((tag) => ({ value: tag.id, label: tag.name })), selectedTags, onTagsChange)}</section>
              <section><h3 className="mb-4 font-semibold">Split status</h3>{filterChoices([{ value: "all", label: "All" }, { value: "split", label: "Split" }, { value: "not_split", label: "Not Split" }], [splitFilter], (next) => onSplitFilterChange((next[0] ?? "all") as SplitFilter))}</section>
              <section><button type="button" onClick={() => setCardsExpanded((value) => !value)} className="flex w-full items-center justify-between text-left"><span className="font-semibold">Cards{selectedCards.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedCards.length}</span>}</span><ChevronRight className={cn("size-4 transition-transform", cardsExpanded && "rotate-90")} /></button>{cardsExpanded && <div className="mt-4">{filterChoices(cards.map((card) => ({ value: card.id, label: card.name })), selectedCards, onCardsChange)}</div>}</section>
            </div>
            <SheetFooter className="sticky bottom-0 flex-row items-center justify-between border-t border-border/50 bg-background px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"><Button type="button" variant="ghost" onClick={clearFilters}>Clear all</Button><Button type="button" onClick={() => setFiltersOpen(false)}>Done</Button></SheetFooter>
          </SheetContent>
        </Sheet>
        <ShortcutRail items={shortcuts} />
      </div>

      {activeChips.length > 0 && <div className="flex min-w-0 items-start gap-2"><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{activeChips.map((chip) => <button key={chip.key} type="button" onClick={chip.onClick} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground"><span>{chip.label}</span><X className="size-3.5" /></button>)}</div>{activeFiltersCount >= 2 && <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-9 shrink-0 px-1 text-xs text-muted-foreground">Clear all</Button>}</div>}
    </div>
  )
}
