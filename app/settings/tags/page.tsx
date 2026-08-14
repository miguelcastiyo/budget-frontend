"use client"

import { useEffect, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import type { Tag } from "@/lib/api/types"
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TagIconPicker } from "@/components/settings/tag-icon-picker"
import { ApiError, apiClient } from "@/lib/api/client"
import { getTagIcon } from "@/lib/tag-icons"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { taxonomyFromState } from "@/lib/domain/financial/view-models"
import { createEncryptedRecordId } from "@/lib/privacy/encrypted-records/crypto"

function tagCountLabel(count: number) {
  return `${count} ${count === 1 ? "tag" : "tags"}`
}

const sameTagId = (left: string, right: string) => left === right || left.split(":").pop() === right.split(":").pop()

async function createEncryptedTag(authority: ReturnType<typeof useFinancialAuthority>["authority"], payload: { name: string; icon_key: string | null }): Promise<Tag> {
  if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
  const id = createEncryptedRecordId()
  await authority.createSource("taxonomy_tag", "taxonomy_tag_v1", id, { id, name: payload.name, icon_key: payload.icon_key, is_deleted: false })
  return { id, name: payload.name, icon_key: payload.icon_key }
}

async function updateEncryptedTag(authority: ReturnType<typeof useFinancialAuthority>["authority"], tagId: string, payload: { name: string; icon_key: string | null }): Promise<Tag> {
  if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
  const record = authority.store.values().find((item) => item.family === "taxonomy_tag" && (sameTagId(item.sourceId, tagId) || sameTagId(String(item.data.id ?? ""), tagId)))
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.update(record.envelope.record_id, { ...record.data, ...payload })
  return { id: tagId, ...payload }
}

async function deleteEncryptedTag(authority: ReturnType<typeof useFinancialAuthority>["authority"], tagId: string): Promise<void> {
  if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
  const record = authority.store.values().find((item) => item.family === "taxonomy_tag" && (sameTagId(item.sourceId, tagId) || sameTagId(String(item.data.id ?? ""), tagId)))
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.commitSourceDiff({
    creates: [],
    updates: [],
    tombstones: [{ id: record.envelope.record_id, family: record.family, data: record.data }],
  })
}

export default function TagsSettingsPage() {
  const financialAuthority = useFinancialAuthority()
  const [tags, setTags] = useState<Tag[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingIconKey, setEditingIconKey] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const [newTagIconKey, setNewTagIconKey] = useState("")
  const [showNewTag, setShowNewTag] = useState(false)
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editingTag = tags.find((tag) => tag.id === editingId) ?? null
  const hasEditingTagChanges = editingTag
    ? editingName.trim() !== editingTag.name.trim() || (editingIconKey || "") !== (editingTag.icon_key ?? "")
    : false
  const NewTagInputIcon = getTagIcon(newTagName || "Tag", newTagIconKey || null)
  const EditingTagInputIcon = getTagIcon(editingName || editingTag?.name || "Tag", editingIconKey || null)

  useEffect(() => {
    const loadTags = async () => {
      try {
        if (financialAuthority.authority) {
          if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
          const state = financialAuthority.authority.getState()
          setTags(taxonomyFromState({ ...state, tags: state.tags.filter((tag) => !tag.isDeleted) }).tags)
        } else {
          throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.error.message)
        } else {
          setError("Unable to load tags")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadTags()
  }, [financialAuthority])

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id)
    setEditingName(tag.name)
    setEditingIconKey(tag.icon_key ?? "")
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const payload = {
        name: editingName.trim(),
        icon_key: editingIconKey || null,
      }
      if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
      const updated = await updateEncryptedTag(financialAuthority.authority, editingId, payload)
      setTags((previous) => previous.map((tag) => (tag.id === editingId ? updated : tag)))
      setEditingId(null)
      setEditingName("")
      setEditingIconKey("")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to update tag")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName("")
    setEditingIconKey("")
  }

  const closeNewTagDrawer = () => {
    setShowNewTag(false)
    setNewTagName("")
    setNewTagIconKey("")
  }

  const handleAddTag = async () => {
    const name = newTagName.trim()
    if (!name) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const payload = {
        name,
        icon_key: newTagIconKey || null,
      }
      if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
      const created = await createEncryptedTag(financialAuthority.authority, payload)
      setTags((previous) => [...previous, created])
      setNewTagName("")
      setNewTagIconKey("")
      setShowNewTag(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to create tag")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteTag = async () => {
    if (!deleteTagId) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
      await deleteEncryptedTag(financialAuthority.authority, deleteTagId)
      setTags((previous) => previous.filter((tag) => tag.id !== deleteTagId))
      setDeleteTagId(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to remove tag")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const openNewTagDialog = () => {
    setNewTagName("")
    setNewTagIconKey("")
    setShowNewTag(true)
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to settings">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="flex-1 text-xl font-bold">Tags</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full sm:hidden"
            aria-label="Create tag"
            onClick={openNewTagDialog}
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button className="hidden rounded-xl sm:inline-flex" onClick={openNewTagDialog}>
            <Plus className="h-4 w-4" />
            New tag
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-5 pt-5">
        <p className="text-sm text-muted-foreground">
          Tags help you categorize your transactions. You can also create new tags when adding a transaction.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold">Tags</h2>
              <p className="text-xs text-muted-foreground">{isLoading ? "Loading tags" : tagCountLabel(tags.length)}</p>
            </div>
          </div>

          {isLoading && (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 p-4 sm:py-3.5">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-secondary" />
                  <div className="h-4 w-32 animate-pulse rounded-full bg-secondary" />
                  <div className="ml-auto h-9 w-9 animate-pulse rounded-full bg-secondary" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && tags.length === 0 && (
            <div className="p-5">
              <p className="font-medium">Could not load tags</p>
              <p className="mt-1 text-sm text-muted-foreground">Try refreshing the page.</p>
            </div>
          )}

          {!isLoading && !error && tags.length === 0 && (
            <div className="p-5">
              <p className="font-medium">No tags yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create tags to organize transactions in a way that fits your budget.
              </p>
              <Button className="mt-4 rounded-xl" onClick={openNewTagDialog}>
                <Plus className="h-4 w-4" />
                New tag
              </Button>
            </div>
          )}

          {!isLoading && tags.length > 0 && (
            <div className="divide-y divide-border">
              {tags.map((tag) => {
                const TagIcon = getTagIcon(tag.name, tag.icon_key)

                return (
                  <div key={tag.id} className="flex min-h-[76px] items-center gap-3 p-4 sm:min-h-[68px] sm:px-5 sm:py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <TagIcon className="h-4 w-4 text-foreground" />
                    </div>
                    <span className="min-w-0 flex-1 truncate font-medium">{tag.name}</span>
                    <div className="flex items-center gap-1 sm:hidden">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Edit ${tag.name}`}
                        onClick={() => handleStartEdit(tag)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full text-destructive hover:text-destructive"
                        aria-label={`Remove ${tag.name}`}
                        onClick={() => setDeleteTagId(tag.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="hidden sm:block">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full text-muted-foreground hover:text-foreground"
                            aria-label={`Tag actions for ${tag.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => handleStartEdit(tag)}>
                            <Pencil className="h-4 w-4" />
                            Edit tag
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTagId(tag.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove tag
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </main>

      <ResponsiveDialog
        open={showNewTag}
        onOpenChange={(open) => {
          if (open) {
            setShowNewTag(true)
          } else {
            closeNewTagDrawer()
          }
        }}
        title="Create tag"
        description="Choose a name and icon."
        mobileSize="compact"
        desktopClassName="sm:w-[min(calc(100dvw-2rem),35rem)] sm:max-w-[35rem]"
        headerClassName="px-4 pb-3 pt-2 sm:px-5 sm:py-4"
        bodyClassName="px-4 py-4 sm:px-5"
        footerClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pt-4"
        footer={
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-xl px-4"
              onClick={closeNewTagDrawer}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-12 rounded-xl text-base font-semibold"
              disabled={!newTagName.trim() || isMutating}
              onClick={() => void handleAddTag()}
            >
              {isMutating ? "Creating..." : "Create tag"}
            </Button>
          </div>
        }
      >
        <div className="grid min-w-0 gap-4">
          <div className="relative min-w-0">
            <NewTagInputIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              className="h-12 rounded-xl pl-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleAddTag()
                }
                if (e.key === "Escape") {
                  closeNewTagDrawer()
                }
              }}
            />
          </div>
          <TagIconPicker tagName={newTagName} value={newTagIconKey} onChange={setNewTagIconKey} desktopGridColumns={7} />
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelEdit()
          }
        }}
        title="Edit tag"
        description={editingTag?.name ?? "Update name and icon"}
        mobileSize="compact"
        desktopClassName="sm:w-[min(calc(100dvw-2rem),35rem)] sm:max-w-[35rem]"
        headerClassName="px-4 pb-3 pt-2 sm:px-5 sm:py-4"
        bodyClassName="px-4 py-4 sm:px-5"
        footerClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pt-4"
        footer={
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-xl px-4"
              onClick={handleCancelEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-12 rounded-xl text-base font-semibold"
              disabled={!editingName.trim() || isMutating || !hasEditingTagChanges}
              onClick={() => void handleSaveEdit()}
            >
              {isMutating ? "Saving..." : "Save tag"}
            </Button>
          </div>
        }
      >
        <div className="grid min-w-0 gap-4">
          <div className="relative min-w-0">
            <EditingTagInputIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="h-12 rounded-xl pl-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSaveEdit()
                }
                if (e.key === "Escape") {
                  handleCancelEdit()
                }
              }}
            />
          </div>
          <TagIconPicker tagName={editingName} value={editingIconKey} onChange={setEditingIconKey} desktopGridColumns={7} />
        </div>
      </ResponsiveDialog>

      <ResponsiveConfirmDialog
        open={!!deleteTagId}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setDeleteTagId(null)
          }
        }}
        title="Remove tag?"
        description="This removes the tag from your available tag list. Existing transactions that already use this tag will not be changed."
        confirmLabel={isMutating ? "Removing..." : "Remove tag"}
        confirmVariant="destructive"
        confirmDisabled={isMutating}
        closeDisabled={isMutating}
        onConfirm={() => void handleDeleteTag()}
      />

      <BottomNav />
    </div>
  )
}
