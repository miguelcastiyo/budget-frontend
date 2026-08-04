import { parseDateValue } from "@/lib/date-filters"
import { parseDisplayMoney, tryParseMoneyCents } from "@/lib/domain/financial/money"

export function canonicalText(value: unknown): string { return String(value ?? "").trim() }

export function canonicalNullableId(value: unknown): string | null {
  const normalized = canonicalText(value)
  return normalized === "" ? null : normalized
}

export function canonicalMoney(value: unknown): number | string | null {
  const parsed = tryParseMoneyCents(typeof value === "number" ? value : canonicalText(value))
  if (parsed !== null) return parsed
  if (value === null || value === undefined || canonicalText(value) === "") return null
  return `invalid:${canonicalText(value)}`
}

export function canonicalDisplayMoney(value: unknown): number { return Math.round(parseDisplayMoney(value as string | number | null | undefined) * 100) }

export function canonicalIsoDate(value: unknown): string {
  const text = canonicalText(value)
  const parsed = parseDateValue(text)
  return parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}` : `invalid:${text}`
}

export function canonicalMonth(value: unknown): string {
  const text = canonicalText(value)
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : `invalid:${text}`
}

export function equalCanonicalSnapshots<T>(left: T, right: T): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null || typeof left !== typeof right) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => equalCanonicalSnapshots(value, right[index]))
  }
  if (typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])
    return [...keys].every((key) => equalCanonicalSnapshots(leftRecord[key], rightRecord[key]))
  }
  return false
}
