"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, Plus, Search } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagIconPicker } from "@/components/settings/tag-icon-picker"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
import { CONTEXT_ICON_OPTIONS, getContextIcon } from "@/lib/tag-icons"
import type { Context } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface ContextPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contexts: Context[]
  selectedContextId: string
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onSelect: (contextId: string) => void
  onCreate: (name: string, iconKey: string) => Promise<void>
}

const RECENT_CONTEXTS_KEY = "budget.recent-context-ids"

export function ContextPickerSheet({
  open,
  onOpenChange,
  contexts,
  selectedContextId,
  isLoading,
  error,
  onRetry,
  onSelect,
  onCreate,
}: ContextPickerSheetProps) {
  const [mode, setMode] = useState<"select" | "create">("select")
  const [query, setQuery] = useState("")
  const [createName, setCreateName] = useState("")
  const [createIconKey, setCreateIconKey] = useState("")
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode("select")
    setQuery("")
    setCreateName("")
    setCreateIconKey("")
    setCreateError(null)
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_CONTEXTS_KEY) ?? "[]")
      setRecentIds(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [])
    } catch {
      setRecentIds([])
    }
  }, [open])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredContexts = useMemo(
    () => contexts.filter((context) => context.name.toLocaleLowerCase().includes(normalizedQuery)),
    [contexts, normalizedQuery]
  )
  const recentContexts = recentIds
    .map((id) => contexts.find((context) => context.id === id))
    .filter((context): context is Context => Boolean(context))
    .filter((context) => normalizedQuery === "" || context.name.toLocaleLowerCase().includes(normalizedQuery))
  const recentContextIds = new Set(recentContexts.map((context) => context.id))
  const allContexts = filteredContexts.filter((context) => !recentContextIds.has(context.id))
  const exactMatch = contexts.some((context) => context.name.trim().toLocaleLowerCase() === normalizedQuery && normalizedQuery !== "")

  const rememberAndSelect = (contextId: string) => {
    const nextRecentIds = [contextId, ...recentIds.filter((id) => id !== contextId)].slice(0, 5)
    setRecentIds(nextRecentIds)
    try {
      window.localStorage.setItem(RECENT_CONTEXTS_KEY, JSON.stringify(nextRecentIds))
    } catch {
      // Recent context history is optional and should never block selection.
    }
    onSelect(contextId)
    onOpenChange(false)
  }

  const startCreate = (name = query.trim()) => {
    setCreateName(name)
    setCreateIconKey("")
    setCreateError(null)
    setMode("create")
  }

  const createContext = async () => {
    const name = createName.trim()
    if (!name || isCreating) return
    setIsCreating(true)
    try {
      await onCreate(name, createIconKey)
      setMode("select")
      onOpenChange(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create context")
    } finally {
      setIsCreating(false)
    }
  }

  const handleBack = () => {
    if (mode === "create") {
      setMode("select")
      setCreateError(null)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),46rem)] w-full grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,46rem)] sm:w-[min(calc(100dvw-2rem),34rem)] sm:max-w-[34rem] sm:rounded-2xl sm:border",
          mobileDrawerDialogClassName
        )}
      >
        <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 backdrop-blur sm:px-5 sm:py-4">
          <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" className="-ml-2 rounded-full" aria-label={mode === "create" ? "Back to context picker" : "Back to transaction"} onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="flex-1 text-lg font-semibold">{mode === "create" ? "New context" : "Context"}</DialogTitle>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {mode === "create" ? (
            <div className="grid gap-5">
              <div>
                <p className="text-sm text-muted-foreground">Choose a name and icon.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-context-name">Name</Label>
                <Input id="new-context-name" value={createName} onChange={(event) => setCreateName(event.target.value)} autoFocus placeholder="Context name" className="h-12 rounded-xl" />
              </div>
              <TagIconPicker
                tagName={createName}
                value={createIconKey}
                onChange={setCreateIconKey}
                entityLabel="Context"
                iconOptions={CONTEXT_ICON_OPTIONS}
                iconResolver={getContextIcon}
                desktopGridColumns={6}
              />
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <Button type="button" className="h-12 rounded-xl" disabled={!createName.trim() || isCreating} onClick={() => void createContext()}>
                {isCreating ? "Creating..." : "Create context"}
              </Button>
            </div>
          ) : (
            <div className="grid min-h-full content-start gap-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search or create a context..." className="h-12 rounded-xl pl-10" autoFocus />
              </div>

              {error ? (
                <div className="rounded-xl border border-border/60 p-4 text-sm">
                  <p className="text-muted-foreground">Unable to load contexts</p>
                  <Button type="button" variant="outline" className="mt-3 h-9 rounded-lg" onClick={onRetry}>Retry</Button>
                </div>
              ) : isLoading ? (
                <p className="py-4 text-sm text-muted-foreground">Loading contexts...</p>
              ) : contexts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-4">
                  <p className="font-medium">No contexts yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first context to group related spending like trips, events, or projects.</p>
                  <Button type="button" className="mt-4 h-10 rounded-xl" onClick={() => startCreate()}><Plus className="h-4 w-4" />Create context</Button>
                </div>
              ) : filteredContexts.length === 0 ? (
                <div className="py-1">
                  <p className="text-sm text-muted-foreground">No matching contexts</p>
                  {!exactMatch && query.trim() && <Button type="button" variant="outline" className="mt-3 h-10 rounded-xl" onClick={() => startCreate()}><Plus className="h-4 w-4" />Create “{query.trim()}”</Button>}
                </div>
              ) : (
                <div className="grid gap-5">
                  {recentContexts.length > 0 && <ContextSection title="Recent" contexts={recentContexts} selectedContextId={selectedContextId} onSelect={rememberAndSelect} />}
                  <ContextSection title={recentContexts.length > 0 ? "All contexts" : undefined} contexts={allContexts} selectedContextId={selectedContextId} onSelect={rememberAndSelect} />
                  {!exactMatch && query.trim() && <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => startCreate()}><Plus className="h-4 w-4" />Create “{query.trim()}”</Button>}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ContextSection({
  title,
  contexts,
  selectedContextId,
  onSelect,
}: {
  title?: string
  contexts: Context[]
  selectedContextId: string
  onSelect: (contextId: string) => void
}) {
  if (contexts.length === 0) return null
  return (
    <section className="grid gap-2">
      {title && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>}
      <div className="divide-y divide-border/60 rounded-xl border border-border/60">
        {contexts.map((context) => {
          const Icon = getContextIcon(context.name, context.icon_key)
          const selected = context.id === selectedContextId
          return (
            <button key={context.id} type="button" onClick={() => onSelect(context.id)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left first:rounded-t-xl last:rounded-b-xl hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{context.name}</span>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
