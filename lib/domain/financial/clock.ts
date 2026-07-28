export interface Clock { now(): Date }

export class SystemClock implements Clock { now(): Date { return new Date() } }

export class FixedClock implements Clock {
  private readonly value: Date
  constructor(isoUtc: string) {
    const parsed = new Date(isoUtc)
    if (Number.isNaN(parsed.getTime())) throw new Error("VALIDATION_FAILED")
    this.value = new Date(parsed.getTime())
  }
  now(): Date { return new Date(this.value.getTime()) }
}

export function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("VALIDATION_FAILED")
  const [year, month, day] = value.split("-").map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) throw new Error("VALIDATION_FAILED")
  return value
}

export function monthKey(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("VALIDATION_FAILED")
  const [year, month] = value.split("-").map(Number)
  if (month < 1 || month > 12) throw new Error("VALIDATION_FAILED")
  return `${year}-${String(month).padStart(2, "0")}`
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = monthKey(month).split("-").map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

export function monthDateRange(month: string): { from: string; to: string } {
  const normalized = monthKey(month)
  return { from: `${normalized}-01`, to: `${normalized}-${String(daysInMonth(normalized)).padStart(2, "0")}` }
}

export function weekdayOfDate(value: string): number {
  dateOnly(value)
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}
