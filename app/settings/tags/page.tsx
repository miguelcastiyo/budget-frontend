"use client"

import { useEffect, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Tag } from "@/lib/api/types"
import { ArrowLeft, Plus, Pencil, Trash2, X, Check } from "lucide-react"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import { getTagIcon, TAG_ICON_OPTIONS } from "@/lib/tag-icons"

export default function TagsSettingsPage() {
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

  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await apiClient.getTags()
        setTags(response.items)
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
  }, [])

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
      const updated = await apiClient.updateTag(editingId, {
        name: editingName.trim(),
        icon_key: editingIconKey || null,
      })
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

  const handleAddTag = async () => {
    const name = newTagName.trim()
    if (!name) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const created = await apiClient.createTag({
        name,
        icon_key: newTagIconKey || null,
      })
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
      await apiClient.deleteTag(deleteTagId)
      setTags((previous) => previous.filter((tag) => tag.id !== deleteTagId))
      setDeleteTagId(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to delete tag")
      }
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1">Tags</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setShowNewTag(true)}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Tags help you categorize your transactions. You can also create new tags when adding a transaction.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {showNewTag && (
          <Card className="p-4 border-0 shadow-sm">
            <div className="space-y-3">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
                className="h-10 rounded-xl"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddTag()
                  if (e.key === "Escape") {
                    setShowNewTag(false)
                    setNewTagName("")
                    setNewTagIconKey("")
                  }
                }}
              />
              <Select
                value={newTagIconKey || "auto"}
                onValueChange={(value) => setNewTagIconKey(value === "auto" ? "" : value)}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Auto icon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto icon (from name)</SelectItem>
                  {TAG_ICON_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <SelectItem key={option.key} value={option.key}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {option.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={() => void handleAddTag()}
                disabled={!newTagName.trim() || isMutating}
              >
                <Check className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setShowNewTag(false)
                  setNewTagName("")
                  setNewTagIconKey("")
                }}
              >
                <X className="w-5 h-5" />
              </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden border-0 shadow-sm divide-y divide-border">
          {!isLoading && tags.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No tags yet.</div>
          )}

          {tags.map((tag) => {
            const TagIcon = getTagIcon(tag.name, tag.icon_key)

            return (
            <div key={tag.id} className="flex items-center gap-3 p-4">
              {editingId === tag.id ? (
                <>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-10 rounded-xl"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveEdit()
                        if (e.key === "Escape") handleCancelEdit()
                      }}
                    />
                    <Select
                      value={editingIconKey || "auto"}
                      onValueChange={(value) => setEditingIconKey(value === "auto" ? "" : value)}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="Auto icon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto icon (from name)</SelectItem>
                        {TAG_ICON_OPTIONS.map((option) => {
                          const Icon = option.icon
                          return (
                            <SelectItem key={option.key} value={option.key}>
                              <span className="inline-flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {option.label}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => void handleSaveEdit()}
                    disabled={!editingName.trim() || isMutating || !hasEditingTagChanges}
                  >
                    <Check className="w-5 h-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    onClick={handleCancelEdit}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <TagIcon className="w-4 h-4 text-foreground" />
                  </div>
                  <span className="flex-1 font-medium">{tag.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => handleStartEdit(tag)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={() => setDeleteTagId(tag.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          )})}
        </Card>
      </main>

      <AlertDialog open={!!deleteTagId} onOpenChange={(open) => !open && setDeleteTagId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag from your list. Existing transactions with this tag will keep their current tag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteTag()}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isMutating}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  )
}
