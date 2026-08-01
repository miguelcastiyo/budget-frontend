import { monthKey } from "./clock"
import type { RecurringRule } from "./recurring"

/** All non-deleted versions, in stable timeline order. */
export function recurringTimeline(rules: RecurringRule[]): RecurringRule[] {
  return rules
    .filter((rule) => !rule.isDeleted)
    .slice()
    .sort((left, right) => left.seriesId.localeCompare(right.seriesId) || left.startsMonth.localeCompare(right.startsMonth) || left.id.localeCompare(right.id))
}

/** Selects the version representing a series in a month, including paused/ended history. */
export function recurringVersionForMonth(rules: RecurringRule[], seriesId: string, month: string): RecurringRule | null {
  const selected = monthKey(month)
  const versions = recurringTimeline(rules).filter((rule) => rule.seriesId === seriesId)
  if (versions.length === 0) return null
  const started = versions.filter((rule) => rule.startsMonth <= selected)
  return started[started.length - 1] ?? versions[0] ?? null
}

/** Finds overlapping active windows so new writes can reject ambiguous schedules. */
export function recurringVersionOverlaps(rules: RecurringRule[]): Array<{ seriesId: string; leftId: string; rightId: string; month: string }> {
  const result: Array<{ seriesId: string; leftId: string; rightId: string; month: string }> = []
  const grouped = new Map<string, RecurringRule[]>()
  for (const rule of recurringTimeline(rules)) grouped.set(rule.seriesId, [...(grouped.get(rule.seriesId) ?? []), rule])
  for (const [seriesId, versions] of grouped) {
    for (let index = 0; index < versions.length; index += 1) {
      const left = versions[index]
      for (const right of versions.slice(index + 1)) {
        const leftEnd = left.endsMonth ?? "9999-12"
        const rightEnd = right.endsMonth ?? "9999-12"
        const start = left.startsMonth > right.startsMonth ? left.startsMonth : right.startsMonth
        if (start <= leftEnd && start <= rightEnd) result.push({ seriesId, leftId: left.id, rightId: right.id, month: start })
      }
    }
  }
  return result
}
