import type { DateRangeFilter } from "@/lib/date-filters"
import type { Category, Preset, SortOrder, SplitFilter } from "@/lib/api/types"

const storageKeyPrefix = "budget:transactions:view:v1:"
const presets: Array<Preset | "all"> = [
  "all",
  "last_7_days",
  "last_30_days",
  "month_to_date",
  "last_month",
  "quarter_to_date",
]
const categories: Category[] = ["needs", "wants", "savings"]
const sortOrders: SortOrder[] = ["date_desc", "date_asc"]
const splitFilters: SplitFilter[] = ["all", "split", "not_split"]

export interface TransactionViewState {
  preset: Preset | "all"
  customDateRange: DateRangeFilter | null
  selectedCategories: Category[]
  selectedTags: string[]
  selectedCards: string[]
  selectedContexts: string[]
  searchQuery: string
  sortOrder: SortOrder
  splitFilter: SplitFilter
}

function getStorageKey(userId: string): string {
  return `${storageKeyPrefix}${encodeURIComponent(userId)}`
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isDateRange(value: unknown): value is DateRangeFilter {
  return isRecord(value) && typeof value.date_from === "string" && typeof value.date_to === "string"
}

function isTransactionViewState(value: unknown): value is TransactionViewState {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.preset === "string" && presets.includes(value.preset as Preset | "all") &&
    (value.customDateRange === null || isDateRange(value.customDateRange)) &&
    isStringArray(value.selectedCategories) && value.selectedCategories.every((item) => categories.includes(item as Category)) &&
    isStringArray(value.selectedTags) &&
    isStringArray(value.selectedCards) &&
    isStringArray(value.selectedContexts) &&
    typeof value.searchQuery === "string" &&
    typeof value.sortOrder === "string" && sortOrders.includes(value.sortOrder as SortOrder) &&
    typeof value.splitFilter === "string" && splitFilters.includes(value.splitFilter as SplitFilter)
  )
}

export function readTransactionViewState(userId: string): TransactionViewState | null {
  const storage = getSessionStorage()
  if (!storage || !userId) {
    return null
  }

  try {
    const serialized = storage.getItem(getStorageKey(userId))
    if (!serialized) {
      return null
    }

    const parsed: unknown = JSON.parse(serialized)
    if (isTransactionViewState(parsed)) {
      return parsed
    }

    storage.removeItem(getStorageKey(userId))
  } catch {
    // Ignore inaccessible or malformed session state and start with defaults.
  }

  return null
}

export function hasTransactionViewState(userId: string): boolean {
  return readTransactionViewState(userId) !== null
}

export function writeTransactionViewState(userId: string, state: TransactionViewState): void {
  const storage = getSessionStorage()
  if (!storage || !userId) {
    return
  }

  try {
    storage.setItem(getStorageKey(userId), JSON.stringify(state))
  } catch {
    // Filter persistence is best-effort and must not interrupt the page.
  }
}

export function clearTransactionViewStates(): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }

  try {
    const keysToRemove: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(storageKeyPrefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key))
  } catch {
    // Cleanup is best-effort when browser storage is unavailable.
  }
}
