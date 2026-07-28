import { FinancialDomainError } from "./errors"
import type { TaxonomyRecord } from "./types"

export function createTaxonomy(input: Omit<TaxonomyRecord, "isDeleted" | "createdSequence"> & { sequence?: number }): TaxonomyRecord {
  if (!input.name.trim()) throw new FinancialDomainError("VALIDATION_FAILED")
  return { ...input, name: input.name.trim(), isDeleted: false, createdSequence: input.sequence ?? 0 }
}

export function taxonomyNameAvailable(records: TaxonomyRecord[], userId: string, name: string, excludingId?: string): boolean {
  const normalized = name.trim().toLocaleLowerCase("en-US")
  return !records.some((record) => record.userId === userId && !record.isDeleted && record.id !== excludingId && record.name.trim().toLocaleLowerCase("en-US") === normalized)
}

export function visibleTaxonomy(records: TaxonomyRecord[]): TaxonomyRecord[] { return records.filter((record) => !record.isDeleted).sort((a, b) => a.name.localeCompare(b.name, "en-US") || a.createdSequence - b.createdSequence || a.id.localeCompare(b.id)) }

export function deleteTaxonomy(record: TaxonomyRecord): TaxonomyRecord { return { ...record, isDeleted: true } }
export function reactivateTaxonomy(record: TaxonomyRecord): TaxonomyRecord { return { ...record, isDeleted: false } }
