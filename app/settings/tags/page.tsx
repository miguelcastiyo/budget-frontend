"use client"

import { useEffect, useRef, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Tag } from "@/lib/api/types"
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError, apiClient } from "@/lib/api/client"
import { getTagIcon, TAG_ICON_OPTIONS } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"

interface TagIconPickerProps {
  tagName: string
  value: string
  onChange: (value: string) => void
}

function TagIconPicker({ tagName, value, onChange }: TagIconPickerProps) {
  const selectedIconOption = TAG_ICON_OPTIONS.find((option) => option.key === value)
  const AutoIcon = getTagIcon(tagName || "Tag", null)
  const PreviewIcon = selectedIconOption?.icon ?? AutoIcon
  const iconLabel = selectedIconOption?.label ?? "Auto"

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Icon</p>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <PreviewIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{iconLabel}</span>
        </span>
      </div>
      <div className="relative min-w-0 max-w-full overflow-hidden sm:overflow-visible">
        <div className="flex max-w-full gap-2 overflow-x-auto scroll-smooth pr-8 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pr-0 [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            aria-pressed={!value}
            aria-label="Use automatic icon"
            title="Auto icon"
            onClick={() => onChange("")}
            className={cn(
              "inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
              !value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <AutoIcon className="h-4 w-4 shrink-0" />
            Auto
          </button>
          {TAG_ICON_OPTIONS.map((option) => {
            const Icon = option.icon
            const isSelected = value === option.key

            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={isSelected}
                aria-label={`Use ${option.label} icon`}
                title={option.label}
                onClick={() => onChange(option.key)}
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/80 to-transparent sm:hidden" aria-hidden="true" />
      </div>
    </div>
  )
}

function tagCountLabel(count: number) {
  return `${count} ${count === 1 ? "tag" : "tags"}`
}

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
  const newTagScrollRef = useRef<HTMLDivElement>(null)
  const editTagScrollRef = useRef<HTMLDivElement>(null)
  const editingTag = tags.find((tag) => tag.id === editingId) ?? null
  const hasEditingTagChanges = editingTag
    ? editingName.trim() !== editingTag.name.trim() || (editingIconKey || "") !== (editingTag.icon_key ?? "")
    : false
  const NewTagInputIcon = getTagIcon(newTagName || "Tag", newTagIconKey || null)
  const EditingTagInputIcon = getTagIcon(editingName || editingTag?.name || "Tag", editingIconKey || null)

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

  const closeNewTagDrawer = () => {
    setShowNewTag(false)
    setNewTagName("")
    setNewTagIconKey("")
  }
  const newTagSwipeDismiss = useSwipeDismiss({
    open: showNewTag,
    onDismiss: closeNewTagDrawer,
    scrollRef: newTagScrollRef,
  })
  const editTagSwipeDismiss = useSwipeDismiss({
    open: editingId !== null,
    onDismiss: handleCancelEdit,
    scrollRef: editTagScrollRef,
  })

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

      <Dialog
        open={showNewTag}
        onOpenChange={(open) => {
          if (open) {
            setShowNewTag(true)
          } else {
            closeNewTagDrawer()
          }
        }}
      >
        <DialogContent
          {...newTagSwipeDismiss}
          showCloseButton={false}
          className={cn(
            "flex h-auto max-h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),34rem)] w-full grid-rows-none gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,36rem)] sm:w-[min(calc(100dvw-2rem),35rem)] sm:max-w-[35rem] sm:rounded-2xl sm:border",
            mobileDrawerDialogClassName
          )}
        >
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAddTag()
            }}
          >
            <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5 sm:py-4">
              <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-semibold">Create tag</DialogTitle>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">Choose a name and icon.</p>
                </div>
                <DialogClose className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>

            <div ref={newTagScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid min-w-0 gap-4">
                <div className="relative min-w-0">
                  <NewTagInputIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="h-12 rounded-xl pl-10"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        closeNewTagDrawer()
                      }
                    }}
                  />
                </div>
                <TagIconPicker tagName={newTagName} value={newTagIconKey} onChange={setNewTagIconKey} />
              </div>
            </div>

            <div className="shrink-0 border-t border-border/50 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-5 sm:pt-4">
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
                  type="submit"
                  className="h-12 rounded-xl text-base font-semibold"
                  disabled={!newTagName.trim() || isMutating}
                >
                  {isMutating ? "Creating..." : "Create tag"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelEdit()
          }
        }}
      >
        <DialogContent
          {...editTagSwipeDismiss}
          showCloseButton={false}
          className={cn(
            "flex h-auto max-h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),34rem)] w-full grid-rows-none gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,36rem)] sm:w-[min(calc(100dvw-2rem),35rem)] sm:max-w-[35rem] sm:rounded-2xl sm:border",
            mobileDrawerDialogClassName
          )}
        >
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveEdit()
            }}
          >
            <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5 sm:py-4">
              <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-semibold">Edit tag</DialogTitle>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {editingTag?.name ?? "Update name and icon"}
                  </p>
                </div>
                <DialogClose className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>

            <div ref={editTagScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid min-w-0 gap-4">
                <div className="relative min-w-0">
                  <EditingTagInputIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-12 rounded-xl pl-10"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        handleCancelEdit()
                      }
                    }}
                  />
                </div>
                <TagIconPicker tagName={editingName} value={editingIconKey} onChange={setEditingIconKey} />
              </div>
            </div>

            <div className="shrink-0 border-t border-border/50 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-5 sm:pt-4">
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
                  type="submit"
                  className="h-12 rounded-xl text-base font-semibold"
                  disabled={!editingName.trim() || isMutating || !hasEditingTagChanges}
                >
                  {isMutating ? "Saving..." : "Save tag"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTagId} onOpenChange={(open) => !open && setDeleteTagId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tag from your available tag list. Existing transactions that already use this tag will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteTag()}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isMutating}
            >
              Remove tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  )
}
