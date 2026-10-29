import type { FinancialCategory } from "@/lib/domain/financial/types"

export const REVIEW_SWIPE_THRESHOLD = 90
export const REVIEW_SWIPE_EDGE = 28
export function reviewSwipeStartAllowed(x: number, width: number): boolean { return x >= REVIEW_SWIPE_EDGE && x <= width - REVIEW_SWIPE_EDGE }
/** Downward and horizontal gestures must be distinct; upward movement never selects. */
export function reviewSwipeCategory(x: number, y: number, threshold = REVIEW_SWIPE_THRESHOLD): FinancialCategory | null {
  if (Math.abs(x) >= threshold && Math.abs(x) > Math.abs(y) * 1.2) return x > 0 ? "needs" : "wants"
  if (y >= threshold && y > Math.abs(x) * 1.2) return "savings"
  return null
}
