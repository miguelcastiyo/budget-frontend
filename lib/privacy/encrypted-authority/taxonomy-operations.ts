import type { Card, Context, Tag } from "@/lib/api/types"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { requireEncryptedAuthority, type EncryptedOperationDependencies } from "./authority-adapters"

export function getEncryptedContexts(deps: EncryptedOperationDependencies): { items: Context[] } {
  const authority = requireEncryptedAuthority(deps)
  return { items: authority.getState().contexts.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name, icon_key: item.iconKey })) }
}

export async function createEncryptedTag(deps: EncryptedOperationDependencies, input: { name: string; icon_key?: string | null }): Promise<Tag> {
  const authority = requireEncryptedAuthority(deps)
  const id = createEncryptedRecordId()
  await authority.createSource("taxonomy_tag", "taxonomy_tag_v1", id, { id, name: input.name, icon_key: input.icon_key ?? null, is_deleted: false })
  return { id, name: input.name, icon_key: input.icon_key ?? null }
}

export async function createEncryptedCard(deps: EncryptedOperationDependencies, input: { name: string }): Promise<Card> {
  const authority = requireEncryptedAuthority(deps)
  const id = createEncryptedRecordId()
  await authority.createSource("taxonomy_card", "taxonomy_card_v1", id, { id, name: input.name, is_favorite: false, is_deleted: false })
  return { id, name: input.name, is_favorite: false }
}

export async function createEncryptedContext(deps: EncryptedOperationDependencies, input: { name: string; icon_key?: string | null }): Promise<Context> {
  const authority = requireEncryptedAuthority(deps)
  const id = createEncryptedRecordId()
  await authority.createSource("taxonomy_context", "taxonomy_context_v1", id, { id, name: input.name, icon_key: input.icon_key ?? null, is_deleted: false })
  return { id, name: input.name, icon_key: input.icon_key ?? null }
}
