export type MoneyCents = number

const MONEY_PATTERN = /^-?\d+(?:\.\d{1,2})?$/

export function parseMoneyCents(value: string | number): MoneyCents {
  const text = typeof value === "number" ? value.toFixed(2) : value.trim().replace(/,/g, "")
  if (!MONEY_PATTERN.test(text)) throw new Error("VALIDATION_FAILED")
  const negative = text.startsWith("-")
  const unsigned = negative ? text.slice(1) : text
  const [whole, fraction = ""] = unsigned.split(".")
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  if (!Number.isSafeInteger(cents)) throw new Error("VALIDATION_FAILED")
  return negative ? -cents : cents
}

export function formatMoneyCents(cents: MoneyCents): string {
  if (!Number.isSafeInteger(cents)) throw new Error("VALIDATION_FAILED")
  const negative = cents < 0
  const absolute = Math.abs(cents)
  return `${negative ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`
}

export function roundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) throw new Error("VALIDATION_FAILED")
  const sign = numerator < 0 ? -1 : 1
  const absolute = Math.abs(numerator)
  return sign * Math.floor((absolute * 2 + denominator) / (2 * denominator))
}

export function allocateByPercent(incomeCents: MoneyCents, percentHundredths: number[]): MoneyCents[] {
  if (percentHundredths.length === 0) return []
  const values = percentHundredths.map((percent) => roundHalfUp(incomeCents * percent, 10000))
  const remainder = incomeCents - values.reduce((sum, value) => sum + value, 0)
  values[values.length - 1] += remainder
  return values
}
