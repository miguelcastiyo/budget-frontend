"use client"

import type {
  Category,
  CsvImportField,
  CsvImportMapping,
  CsvImportPreviewResponse,
  CsvImportResponse,
  CsvImportTagStrategyEntry,
  DataRunItem,
  DataRunStatus,
  Tag,
} from "@/lib/api/types"

export type ExportDateMode = "all" | "custom"
export type ImportStep = "upload" | "map" | "dates" | "categories" | "tags" | "review" | "done"
export type CategorySetupMode = "value_map" | "default" | "exact_column"
export type HeaderImportField = Exclude<CsvImportField, "category">

export const HEADER_IMPORT_FIELDS: Array<{ key: HeaderImportField; label: string; required: boolean; hint: string }> = [
  { key: "date", label: "Date", required: true, hint: "Transaction date" },
  { key: "expense", label: "Expense", required: true, hint: "Merchant or description" },
  { key: "amount", label: "Amount", required: true, hint: "Positive transaction amount" },
  { key: "tag", label: "Spending tag", required: true, hint: "Creates or matches spending tags" },
  { key: "card", label: "Card", required: false, hint: "Creates or matches cards" },
  { key: "context", label: "Context", required: false, hint: "Encrypted mode: creates or matches contexts" },
  { key: "is_split", label: "Split", required: false, hint: "Optional true/false flag" },
  { key: "notes", label: "Note", required: false, hint: "Optional transaction note" },
]

export const NONE_VALUE = "__none"

export const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: "needs", label: "Needs" },
  { value: "wants", label: "Wants" },
  { value: "savings", label: "Savings" },
]

const CATEGORY_SOURCE_HINTS = ["bank_category_guess", "category", "budget_category", "type", "label", "tag", "tags"]

function normalizedHeader(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

function inferCategory(value: string): Category {
  const normalized = value.toLowerCase().trim()
  if (normalized === "needs" || normalized.includes("need")) {
    return "needs"
  }
  if (normalized === "wants" || normalized.includes("want")) {
    return "wants"
  }
  if (["debt", "debts", "loan", "loans", "credit card payment", "credit card payments"].some((keyword) => normalized.includes(keyword))) {
    return "needs"
  }
  if (normalized.includes("savings")) {
    return "savings"
  }
  if (["savings", "saving", "investment", "investments"].some((keyword) => normalized.includes(keyword))) {
    return "savings"
  }
  if (["dining", "coffee", "entertainment", "shopping", "travel", "misc", "restaurant", "movie"].some((keyword) => normalized.includes(keyword))) {
    return "wants"
  }
  return "needs"
}

export function bestCategorySource(preview: CsvImportPreviewResponse): string {
  const headersByNormalized = new Map(preview.headers.map((header) => [normalizedHeader(header), header]))
  for (const hint of CATEGORY_SOURCE_HINTS) {
    const exact = headersByNormalized.get(hint)
    if (exact) {
      return exact
    }
  }

  return preview.suggested_mapping.category ?? preview.suggested_mapping.tag ?? preview.headers[0] ?? ""
}

export function profileForHeader(preview: CsvImportPreviewResponse | null, header: string) {
  return preview?.column_profiles.find((profile) => profile.header === header) ?? null
}

export function dateProfileForHeader(preview: CsvImportPreviewResponse | null, header: string) {
  return preview?.date_profiles.find((profile) => profile.header === header) ?? null
}

export function defaultCategoryMap(preview: CsvImportPreviewResponse, sourceHeader: string): Record<string, Category> {
  const profile = profileForHeader(preview, sourceHeader)
  if (!profile) {
    return {}
  }

  return Object.fromEntries(profile.unique_values.map((item) => [item.value, inferCategory(item.value)]))
}

export function currentImportYear(): number {
  return new Date().getFullYear()
}

export function defaultTagValueMap(
  preview: CsvImportPreviewResponse,
  tagHeader: string,
  tags: Tag[]
): Record<string, CsvImportTagStrategyEntry> {
  const profile = profileForHeader(preview, tagHeader)
  if (!profile) {
    return {}
  }
  const tagsByName = new Map(tags.map((tag) => [tag.name.trim().toLowerCase(), tag]))

  return Object.fromEntries(profile.unique_values.map((item) => {
    const existing = tagsByName.get(item.value.trim().toLowerCase())
    return [
      item.value,
      existing ? { mode: "existing", tag_id: existing.id } : { mode: "new", name: item.value },
    ]
  }))
}

export function statusLabel(status: DataRunStatus): string {
  if (status === "started") return "Started"
  if (status === "completed") return "Completed"
  if (status === "partial") return "Partial"
  return "Failed"
}

export function activityStatusLabel(item: DataRunItem): string {
  if (item.type === "import" && item.rolled_back_at) {
    return "Rolled back"
  }

  return statusLabel(item.status)
}

export function statusClassName(status: DataRunStatus): string {
  if (status === "completed") return "bg-success/10 text-success"
  if (status === "partial") return "bg-warning/10 text-warning"
  if (status === "started") return "bg-primary/10 text-primary"
  return "bg-destructive/10 text-destructive"
}

export function activityStatusClassName(item: DataRunItem): string {
  if (item.type === "import" && item.rolled_back_at) {
    return "bg-muted text-muted-foreground"
  }

  return statusClassName(item.status)
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`
}

export function plannedImportCount(result: CsvImportResponse): number {
  if (result.imported_rows > 0) {
    return result.imported_rows
  }

  return Math.max(result.valid_rows - result.duplicate_rows - result.skipped_rows, 0)
}

export function reviewSummarySentence(result: CsvImportResponse): string {
  return `${pluralize(result.total_rows, "row")} checked. ${plannedImportCount(result).toLocaleString()} will be imported. ${pluralize(result.duplicate_rows, "duplicate")} will be skipped.`
}

export function completeSummarySentence(result: CsvImportResponse): string {
  const duplicateText = result.duplicate_rows > 0 ? ` Skipped ${pluralize(result.duplicate_rows, "duplicate")}.` : ""
  const invalidText = result.invalid_rows > 0 ? ` Skipped ${pluralize(result.invalid_rows, "invalid row")}.` : ""
  return `Imported ${pluralize(result.imported_rows, "row")}.${duplicateText}${invalidText}`
}

export function importRunIdFromDataRun(item: DataRunItem): string | null {
  if (item.type !== "import") {
    return null
  }

  if (!item.id.startsWith("import_")) {
    return item.id || null
  }

  const id = item.id.slice("import_".length)
  return /^\d+$/.test(id) ? id : null
}

export function importStepIndex(step: ImportStep): number {
  if (step === "upload") return 0
  if (step === "map") return 1
  if (step === "dates") return 2
  if (step === "categories") return 3
  if (step === "tags") return 4
  if (step === "review") return 5
  return 6
}

export function nextImportStep(
  step: ImportStep,
  options: {
    importPreview: CsvImportPreviewResponse | null
    requiredMappingComplete: boolean
    hasDuplicateMapping: boolean
    needsDateSetup: boolean
    dateSetupComplete: boolean
    categorySetupComplete: boolean
    canValidateImport: boolean
  }
): ImportStep | null {
  if (step === "upload" && options.importPreview) {
    return "map"
  }
  if (step === "map" && options.requiredMappingComplete && !options.hasDuplicateMapping) {
    return options.needsDateSetup ? "dates" : "categories"
  }
  if (step === "dates" && options.dateSetupComplete) {
    return "categories"
  }
  if (step === "categories" && options.categorySetupComplete) {
    return "tags"
  }
  if (step === "tags" && options.canValidateImport) {
    return "review"
  }

  return null
}

export function previousImportStep(step: ImportStep, needsDateSetup: boolean): ImportStep | null {
  if (step === "done") return "review"
  if (step === "review") return "tags"
  if (step === "tags") return "categories"
  if (step === "categories") return needsDateSetup ? "dates" : "map"
  if (step === "dates") return "map"
  if (step === "map") return "upload"
  return null
}

export function createEmptyImportState() {
  return {
    importFile: null as File | null,
    importStep: "upload" as ImportStep,
    importPreview: null as CsvImportPreviewResponse | null,
    importMapping: {} as CsvImportMapping,
    dateYear: "",
    categoryMode: "value_map" as CategorySetupMode,
    categorySourceHeader: "",
    categoryValueMap: {} as Record<string, Category>,
    tagValueMap: {} as Record<string, CsvImportTagStrategyEntry>,
    defaultCategory: "needs" as Category,
  }
}
