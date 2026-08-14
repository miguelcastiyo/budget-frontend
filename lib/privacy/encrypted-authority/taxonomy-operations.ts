import type { Card, Context, Tag } from "@/lib/api/types"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { requireEncryptedAuthority, type EncryptedOperationDependencies } from "./authority-adapters"
import { resolveRecord } from "./authority-adapters"
import type { EncryptedFinancialAuthority } from "./authority"

export function getEncryptedContexts(deps: EncryptedOperationDependencies): { items: Context[] } {
  const authority = requireEncryptedAuthority(deps)
  return { items: authority.getState().contexts.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name, icon_key: item.iconKey })) }
}

export function getEncryptedTags(deps: EncryptedOperationDependencies): Tag[] {
  const authority = requireEncryptedAuthority(deps)
  return authority.getState().tags.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name, icon_key: item.iconKey }))
}

export function getEncryptedCards(deps: EncryptedOperationDependencies): Card[] {
  const authority = requireEncryptedAuthority(deps)
  return authority.getState().cards.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name, is_favorite: item.isFavorite }))
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

export async function updateEncryptedTag(authority: EncryptedFinancialAuthority, id: string, input: { name: string; icon_key: string | null }): Promise<Tag> {
  const record = resolveRecord(authority, "taxonomy_tag", id)
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.update(record.envelope.record_id, { ...record.data, ...input })
  return { id, ...input }
}

export async function deleteEncryptedTag(authority: EncryptedFinancialAuthority, id: string): Promise<void> {
  const record = resolveRecord(authority, "taxonomy_tag", id)
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: record.envelope.record_id, family: record.family, data: record.data }] })
}

export async function updateEncryptedCard(authority: EncryptedFinancialAuthority, id: string, input: { name?: string; is_favorite?: boolean }): Promise<Card> {
  const record = resolveRecord(authority, "taxonomy_card", id)
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  if (input.is_favorite) {
    for (const other of authority.store.values().filter((item) => item.family === "taxonomy_card" && item.envelope.record_id !== record.envelope.record_id && item.data.is_favorite === true)) {
      await authority.update(other.envelope.record_id, { ...other.data, is_favorite: false })
    }
  }
  await authority.update(record.envelope.record_id, { ...record.data, ...input })
  return { id, name: String(input.name ?? record.data.name ?? ""), is_favorite: input.is_favorite ?? record.data.is_favorite === true }
}

export async function deleteEncryptedCard(authority: EncryptedFinancialAuthority, id: string): Promise<void> {
  const record = resolveRecord(authority, "taxonomy_card", id)
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: record.envelope.record_id, family: record.family, data: record.data }] })
}

export async function updateEncryptedContext(authority: EncryptedFinancialAuthority, id: string, input: { name: string; icon_key: string | null }): Promise<Context> {
  const record = resolveRecord(authority, "taxonomy_context", id)
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.commitSourceDiff({ creates: [], updates: [{ id: record.envelope.record_id, family: record.family, data: { ...record.data, ...input } }], tombstones: [] })
  return { id, ...input }
}

export async function deleteEncryptedContext(authority: EncryptedFinancialAuthority, id: string): Promise<void> {
  const record = resolveRecord(authority, "taxonomy_context", id)
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: record.envelope.record_id, family: record.family, data: record.data }] })
}
