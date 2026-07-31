import type { EncryptedFinancialAuthority } from "./authority"

const CONTEXT_ICON_REMAP: Record<string, string> = {
  "Breakfast": "utensils",
  "Skin Care": "sparkles",
  "Movies": "film",
  "Coffee": "coffee",
  "Books": "book_open",
  "Clothes": "shirt",
  "Hair Care": "scissors",
  "Snacks": "cookie",
  "CDMX 26": "map_pinned",
  "Parking": "car",
}

/**
 * Explicit, one-time client-side remap for the named contexts in the unlocked
 * encrypted authority. It preserves record IDs, names, relationships, and all
 * other encrypted fields.
 */
export async function remapNamedEncryptedContextIcons(authority: EncryptedFinancialAuthority): Promise<string[]> {
  const changed: string[] = []
  for (const record of authority.store.values()) {
    if (record.family !== "taxonomy_context") continue
    const name = String(record.data.name ?? "").trim()
    const iconKey = CONTEXT_ICON_REMAP[name]
    if (!iconKey || record.data.icon_key === iconKey) continue
    await authority.update(record.envelope.record_id, { ...record.data, icon_key: iconKey })
    changed.push(name)
  }
  return changed
}

export { CONTEXT_ICON_REMAP }
