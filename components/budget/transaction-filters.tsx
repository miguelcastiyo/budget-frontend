"use client"

import { useRef, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar as AppCalendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  CalendarIcon,
  Folder,
  Tag as TagIcon,
  CreditCard,
} from "lucide-react"
import { format } from "date-fns"
import type { Tag, Card, Category, Preset, SplitFilter } from "@/lib/api/types"
import { parseIsoDate, transactionFilterPresets } from "@/lib/date-filters"
import { cn } from "@/lib/utils"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import type { ReactNode } from "react"

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
  cards: Card[]
  searchQuery: string
  onSearchChange: (query: string) => void
  splitFilter: SplitFilter
  onSplitFilterChange: (value: SplitFilter) => void
  monthFilterLabel?: string | null
  onClearMonthFilter?: () => void
  customDateRange?: {
    date_from: string
    date_to: string
  } | null
  onCustomDateRangeChange: (range: { date_from: string; date_to: string } | null) => void
  desktopSidebarToggle?: ReactNode
}

const categories: { value: Category; label: string }[] = [
  { value: "needs", label: "Needs" },
  { value: "wants", label: "Wants" },
  { value: "savings_debts", label: "Savings & Debts" },
]

interface ChipRailItem {
  key: string
  label: string
  selected: boolean
  onClick: () => void
}

function ChipRail({ items }: { items: ChipRailItem[] }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (!railRef.current) {
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = railRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    const node = railRef.current
    if (!node) {
      return
    }

    node.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)
    return () => {
      node.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [items.length])

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) {
      return
    }

    railRef.current.scrollBy({
      left: direction === "left" ? -150 : 150,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center bg-gradient-to-r from-background via-background to-transparent"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      <div
        ref={railRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cn(
              "flex-shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              item.selected
                ? "border-secondary bg-secondary text-foreground"
                : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center bg-gradient-to-l from-background via-background to-transparent"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
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
  selectedCards,
  onCardsChange,
  tags,
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
}: TransactionFiltersProps) {
  const [mobileQuickFiltersOpen, setMobileQuickFiltersOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(customDateRange?.date_from ?? "")
  const [customTo, setCustomTo] = useState(customDateRange?.date_to ?? "")
  const [customRangeError, setCustomRangeError] = useState<string | null>(null)
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
  }, [customDateRange?.date_from, customDateRange?.date_to])

  const activeFiltersCount = 
    (monthFilterLabel ? 1 : 0) +
    (customDateRange && !monthFilterLabel ? 1 : 0) +
    (preset !== "all" ? 1 : 0) + 
    selectedCategories.length + 
    selectedTags.length + 
    selectedCards.length +
    (splitFilter !== "all" ? 1 : 0)
  const selectedPresetLabel = preset !== "all"
    ? (transactionFilterPresets.find((p) => p.value === preset)?.label ?? null)
    : null

  const toggleCategory = (category: Category) => {
    if (selectedCategories.includes(category)) {
      onCategoriesChange(selectedCategories.filter(c => c !== category))
    } else {
      onCategoriesChange([...selectedCategories, category])
    }
  }

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(t => t !== tagId))
    } else {
      onTagsChange([...selectedTags, tagId])
    }
  }

  const toggleCard = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      onCardsChange(selectedCards.filter(c => c !== cardId))
    } else {
      onCardsChange([...selectedCards, cardId])
    }
  }

  const clearFilters = () => {
    onPresetChange("all")
    if (monthFilterLabel) {
      onClearMonthFilter?.()
    } else {
      onCustomDateRangeChange(null)
    }
    onCategoriesChange([])
    onTagsChange([])
    onCardsChange([])
    onSplitFilterChange("all")
  }

  const applyCustomDateRange = () => {
    const from = customFrom.trim()
    const to = customTo.trim()

    if (!from || !to) {
      setCustomRangeError("Select both a start and end date.")
      return
    }

    if (from > to) {
      setCustomRangeError("Start date must be before or equal to end date.")
      return
    }

    setCustomRangeError(null)
    onCustomDateRangeChange({ date_from: from, date_to: to })
  }

  const clearCustomDateRange = () => {
    setCustomFrom("")
    setCustomTo("")
    setCustomRangeError(null)
    onCustomDateRangeChange(null)
  }

  const splitFilterItems: ChipRailItem[] = [
    {
      key: "split-all",
      label: "All",
      selected: splitFilter === "all",
      onClick: () => onSplitFilterChange("all"),
    },
    {
      key: "split-split",
      label: "Split",
      selected: splitFilter === "split",
      onClick: () => onSplitFilterChange("split"),
    },
    {
      key: "split-not-split",
      label: "Not Split",
      selected: splitFilter === "not_split",
      onClick: () => onSplitFilterChange("not_split"),
    },
  ]

  const dateRangeItems: ChipRailItem[] = transactionFilterPresets.map((p) => ({
    key: `preset-${p.value}`,
    label: p.label,
    selected: preset === p.value,
    onClick: () => onPresetChange(p.value),
  }))

  const categoryItems: ChipRailItem[] = categories.map((cat) => ({
    key: `category-${cat.value}`,
    label: cat.label,
    selected: selectedCategories.includes(cat.value),
    onClick: () => toggleCategory(cat.value),
  }))

  const tagItems: ChipRailItem[] = tags.map((tag) => ({
    key: `tag-${tag.id}`,
    label: tag.name,
    selected: selectedTags.includes(tag.id),
    onClick: () => toggleTag(tag.id),
  }))

  const cardItems: ChipRailItem[] = cards.map((card) => ({
    key: `card-${card.id}`,
    label: card.name,
    selected: selectedCards.includes(card.id),
    onClick: () => toggleCard(card.id),
  }))

  const selectedFromDate = parseIsoDate(customFrom)
  const selectedToDate = parseIsoDate(customTo)

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        {desktopSidebarToggle && (
          <div className="hidden lg:flex shrink-0">
            {desktopSidebarToggle}
          </div>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-11 rounded-xl"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-2">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-9 px-3 border border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground flex-1 lg:flex-none justify-center"
            >
              <SlidersHorizontal className="w-4 h-4 mr-1.5" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            {...filtersSwipeDismiss}
            side="bottom"
            className="h-[80vh] lg:h-auto lg:max-h-[70vh] rounded-t-3xl p-0 gap-0"
          >
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
              <div data-swipe-handle="true" className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-border lg:hidden" aria-hidden="true" />
              <div className="flex items-center justify-between">
                <SheetTitle className="text-xl font-semibold">Filters</SheetTitle>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>
            </SheetHeader>
            
            <div ref={filtersScrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              {/* Date range */}
              <div>
                <h3 className="font-semibold mb-4 text-base">Date Range</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">From</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-10 rounded-xl justify-start text-left font-normal",
                            !selectedFromDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {selectedFromDate ? format(selectedFromDate, "EEEE, MMMM d, yyyy") : "Select start date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <AppCalendar
                          mode="single"
                          selected={selectedFromDate ?? undefined}
                          onSelect={(value) => {
                            if (!value) {
                              return
                            }
                            setCustomFrom(format(value, "yyyy-MM-dd"))
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">To</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-10 rounded-xl justify-start text-left font-normal",
                            !selectedToDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {selectedToDate ? format(selectedToDate, "EEEE, MMMM d, yyyy") : "Select end date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <AppCalendar
                          mode="single"
                          selected={selectedToDate ?? undefined}
                          onSelect={(value) => {
                            if (!value) {
                              return
                            }
                            setCustomTo(format(value, "yyyy-MM-dd"))
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {customRangeError && (
                  <p className="mt-2 text-xs text-destructive">{customRangeError}</p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyCustomDateRange}
                    className="rounded-full"
                  >
                    Apply Range
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearCustomDateRange}
                    className="rounded-full"
                    disabled={!customDateRange && !customFrom && !customTo}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Categories */}
              <div>
                <h3 className="font-semibold mb-4 text-base">Category</h3>
                <div className="flex flex-wrap gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => toggleCategory(cat.value)}
                      className={cn(
                        "cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
                        selectedCategories.includes(cat.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="font-semibold mb-4 text-base">Tags</h3>
                <div className="flex flex-wrap gap-3">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
                        selectedTags.includes(tag.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards */}
              <div>
                <h3 className="font-semibold mb-4 text-base">Cards</h3>
                <div className="flex flex-wrap gap-3">
                  {cards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => toggleCard(card.id)}
                      className={cn(
                        "cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
                        selectedCards.includes(card.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {card.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMobileQuickFiltersOpen((current) => !current)}
          className="lg:hidden flex-1 h-9 rounded-full border border-border/70 bg-background px-3 text-muted-foreground hover:border-border hover:text-foreground justify-center gap-1.5"
        >
          <span className="text-xs font-medium uppercase tracking-wide">
            {mobileQuickFiltersOpen ? "Hide Quick" : "Quick Filters"}
          </span>
          {mobileQuickFiltersOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>

        {activeFiltersCount > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:inline-flex rounded-full h-8 px-3 text-xs border border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
            onClick={clearFilters}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Applied filter badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {monthFilterLabel && (
          <Badge
            variant="secondary"
            className="rounded-full cursor-pointer py-1 px-3"
            onClick={() => onClearMonthFilter?.()}
          >
            Month: {monthFilterLabel}
            <X className="w-3 h-3 ml-1.5" />
          </Badge>
        )}
        {customDateRange && !monthFilterLabel && (
          <Badge
            variant="secondary"
            className="rounded-full cursor-pointer py-1 px-3"
            onClick={clearCustomDateRange}
          >
            {customDateRange.date_from} to {customDateRange.date_to}
            <X className="w-3 h-3 ml-1.5" />
          </Badge>
        )}
        {selectedPresetLabel && (
          <Badge
            variant="secondary"
            className="rounded-full cursor-pointer py-1 px-3"
            onClick={() => onPresetChange("all")}
          >
            {selectedPresetLabel}
            <X className="w-3 h-3 ml-1.5" />
          </Badge>
        )}
        {selectedCategories.map((cat) => (
          <Badge 
            key={cat} 
            variant="secondary" 
            className="rounded-full cursor-pointer py-1 px-3"
            onClick={() => toggleCategory(cat)}
          >
            {categories.find(c => c.value === cat)?.label}
            <X className="w-3 h-3 ml-1.5" />
          </Badge>
        ))}
        {selectedTags.map((tagId) => (
          <Badge 
            key={tagId} 
            variant="secondary" 
            className="rounded-full cursor-pointer py-1 px-3"
            onClick={() => toggleTag(tagId)}
          >
            {tags.find(t => t.id === tagId)?.name}
            <X className="w-3 h-3 ml-1.5" />
          </Badge>
        ))}
        {selectedCards.map((cardId) => (
          <Badge 
            key={cardId} 
            variant="secondary" 
            className="rounded-full cursor-pointer py-1 px-3"
            onClick={() => toggleCard(cardId)}
          >
            {cards.find(c => c.id === cardId)?.name}
            <X className="w-3 h-3 ml-1.5" />
          </Badge>
        ))}
        {splitFilter !== "all" && (
          <Badge
            variant="secondary"
            className="rounded-full cursor-pointer py-1 px-3"
            onClick={() => onSplitFilterChange("all")}
          >
            {splitFilter === "split" ? "Split" : "Not Split"}
            <X className="w-3 h-3 ml-1.5" />
          </Badge>
        )}
      </div>

      <div className={cn("space-y-4", !mobileQuickFiltersOpen && "hidden lg:block")}>
        {/* Quick filters */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Filters</p>
          <ChipRail items={splitFilterItems} />
        </div>

        {/* Date Presets */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Date Range</span>
          </div>
          <ChipRail items={dateRangeItems} />
        </div>

        {/* Category quick filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Folder className="w-3.5 h-3.5" />
            <span>Category</span>
          </div>
          <ChipRail items={categoryItems} />
        </div>

        {/* Tags quick filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <TagIcon className="w-3.5 h-3.5" />
            <span>Tags</span>
          </div>
          <ChipRail items={tagItems} />
        </div>

        {/* Cards quick filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Cards</span>
          </div>
          <ChipRail items={cardItems} />
        </div>

      </div>

    </div>
  )
}
