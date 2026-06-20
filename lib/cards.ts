import type { Card } from "@/lib/api/types"

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) {
      return a.is_favorite ? -1 : 1
    }

    const nameCompare = a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    if (nameCompare !== 0) {
      return nameCompare
    }

    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })
  })
}
