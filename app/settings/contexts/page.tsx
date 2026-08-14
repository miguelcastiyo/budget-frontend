"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TagIconPicker } from "@/components/settings/tag-icon-picker"
import { ApiError, apiClient } from "@/lib/api/client"
import { CONTEXT_ICON_OPTIONS, getContextIcon, getContextIconByKey } from "@/lib/tag-icons"
import type { Context } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { taxonomyFromState } from "@/lib/domain/financial/view-models"
import { createEncryptedRecordId } from "@/lib/privacy/encrypted-records/crypto"

const sameContextId = (left: string, right: string) => left === right || left.split(":").pop() === right.split(":").pop()
async function createEncryptedContext(authority: ReturnType<typeof useFinancialAuthority>["authority"], payload: { name: string; icon_key: string | null }): Promise<Context> { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const id = createEncryptedRecordId(); await authority.createSource("taxonomy_context", "taxonomy_context_v1", id, { id, name: payload.name, icon_key: payload.icon_key, is_deleted: false }); return { id, ...payload } }
async function updateEncryptedContext(authority: ReturnType<typeof useFinancialAuthority>["authority"], contextId: string, payload: { name: string; icon_key: string | null }): Promise<Context> { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const record = authority.store.values().find((item) => item.family === "taxonomy_context" && (sameContextId(item.sourceId, contextId) || sameContextId(String(item.data.id ?? ""), contextId))); if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); await authority.commitSourceDiff({ creates: [], updates: [{ id: record.envelope.record_id, family: record.family, data: { ...record.data, ...payload } }], tombstones: [] }); return { id: contextId, ...payload } }
async function deleteEncryptedContext(authority: ReturnType<typeof useFinancialAuthority>["authority"], contextId: string): Promise<void> { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const record = authority.store.values().find((item) => item.family === "taxonomy_context" && (sameContextId(item.sourceId, contextId) || sameContextId(String(item.data.id ?? ""), contextId))); if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); await authority.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: record.envelope.record_id, family: record.family, data: record.data }] }) }

export default function ContextsSettingsPage() {
  const financialAuthority = useFinancialAuthority()
  const [contexts, setContexts] = useState<Context[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingIconKey, setEditingIconKey] = useState("")
  const [newName, setNewName] = useState("")
  const [newIconKey, setNewIconKey] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = contexts.find((item) => item.id === editingId) ?? null
  const newIcon = getContextIcon(newName || "Context", newIconKey || null)
  const editIcon = getContextIcon(editingName || editing?.name || "Context", editingIconKey || null)
  const NewIcon = newIcon
  const EditIcon = editIcon

  useEffect(() => {
    const loadContexts = financialAuthority.authority
      ? Promise.resolve().then(() => { if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const state = financialAuthority.authority.getState(); return { items: taxonomyFromState({ ...state, contexts: state.contexts.filter((item) => !item.isDeleted) }).contexts } })
      : Promise.reject(new Error("ENCRYPTED_AUTHORITY_REQUIRED"))
    loadContexts
      .then((response) => setContexts(response.items))
      .catch((err) => setError(err instanceof ApiError ? err.error.message : "Unable to load contexts"))
      .finally(() => setIsLoading(false))
  }, [financialAuthority])

  const resetNew = () => {
    setShowNew(false)
    setNewName("")
    setNewIconKey("")
  }

  const startEdit = (item: Context) => {
    setEditingId(item.id)
    setEditingName(item.name)
    // Older Context records may contain keys from the previous palette. Treat
    // those as Auto so editing can always be saved with the current palette.
    setEditingIconKey(item.icon_key && getContextIconByKey(item.icon_key) ? item.icon_key : "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName("")
    setEditingIconKey("")
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    setIsMutating(true)
    setError(null)
    try {
      const payload = { name: editingName.trim(), icon_key: editingIconKey || null }
      if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
      const updated = await updateEncryptedContext(financialAuthority.authority, editingId, payload)
      setContexts((current) => current.map((item) => item.id === editingId ? updated : item))
      cancelEdit()
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to update context")
    } finally {
      setIsMutating(false)
    }
  }

  const createContext = async () => {
    if (!newName.trim()) return
    setIsMutating(true)
    setError(null)
    try {
      const payload = { name: newName.trim(), icon_key: newIconKey || null }
      if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
      const created = await createEncryptedContext(financialAuthority.authority, payload)
      setContexts((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      resetNew()
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to create context")
    } finally {
      setIsMutating(false)
    }
  }

  const deleteContext = async () => {
    if (!deleteId) return
    setIsMutating(true)
    setError(null)
    try {
      if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
      await deleteEncryptedContext(financialAuthority.authority, deleteId)
      setContexts((current) => current.filter((item) => item.id !== deleteId))
      setDeleteId(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to remove context")
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <Link href="/settings"><Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to settings"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="flex-1 text-xl font-bold">Contexts</h1>
          <Button variant="ghost" size="icon" className="rounded-full sm:hidden" aria-label="Create context" onClick={() => setShowNew(true)}><Plus className="h-5 w-5" /></Button>
          <Button className="hidden rounded-xl sm:inline-flex" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" />New context</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-5 pt-5">
        <p className="text-sm text-muted-foreground">Group related spending across different tags. Contexts are useful for trips, events, projects, and other one-off expenses.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5"><div><h2 className="text-sm font-semibold">Contexts</h2><p className="text-xs text-muted-foreground">{isLoading ? "Loading contexts" : `${contexts.length} ${contexts.length === 1 ? "context" : "contexts"}`}</p></div></div>
          {isLoading && <div className="divide-y divide-border">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex items-center gap-3 p-4"><div className="h-9 w-9 animate-pulse rounded-xl bg-secondary" /><div className="h-4 w-32 animate-pulse rounded-full bg-secondary" /></div>)}</div>}
          {!isLoading && !error && contexts.length === 0 && <div className="p-5"><p className="font-medium">No contexts yet</p><p className="mt-1 text-sm text-muted-foreground">Contexts help group related spending across tags, like a trip, event, or project.</p><Button className="mt-4 rounded-xl" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" />Add context</Button></div>}
          {!isLoading && contexts.length > 0 && <div className="divide-y divide-border">{contexts.map((item) => { const Icon = getContextIcon(item.name, item.icon_key); return <div key={item.id} className="flex min-h-[76px] items-center gap-3 p-4 sm:min-h-[68px] sm:px-5 sm:py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary"><Icon className="h-4 w-4 text-foreground" /></div><span className="min-w-0 flex-1 truncate font-medium">{item.name}</span><div className="flex items-center gap-1 sm:hidden"><Button size="icon" variant="ghost" className="rounded-full" aria-label={`Edit ${item.name}`} onClick={() => startEdit(item)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="rounded-full text-destructive" aria-label={`Remove ${item.name}`} onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button></div><div className="hidden sm:block"><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="rounded-full" aria-label={`Context actions for ${item.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl"><DropdownMenuItem onClick={() => startEdit(item)}><Pencil className="h-4 w-4" />Edit context</DropdownMenuItem><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" />Remove context</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div> })}</div>}
        </Card>
      </main>
      <ResponsiveDialog open={showNew} onOpenChange={(open) => open ? setShowNew(true) : resetNew()} title="Create context" description="Choose a name and icon." mobileSize="compact" desktopClassName="sm:w-[min(calc(100dvw-2rem),35rem)] sm:max-w-[35rem]" headerClassName="px-4 pb-3 pt-2 sm:px-5 sm:py-4" bodyClassName="px-4 py-4 sm:px-5" footerClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pt-4" footer={<div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={resetNew}>Cancel</Button><Button type="button" className="h-12 rounded-xl" disabled={!newName.trim() || isMutating} onClick={() => void createContext()}>{isMutating ? "Creating..." : "Create context"}</Button></div>}>
        <div className="grid gap-4"><div className="relative"><NewIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createContext() } if (event.key === "Escape") resetNew() }} placeholder="Context name" className="h-12 rounded-xl pl-10" /></div><TagIconPicker tagName={newName} value={newIconKey} onChange={setNewIconKey} entityLabel="Context" iconOptions={CONTEXT_ICON_OPTIONS} iconResolver={getContextIcon} desktopGridColumns={6} /></div>
      </ResponsiveDialog>
      <ResponsiveDialog open={editingId !== null} onOpenChange={(open) => !open && cancelEdit()} title="Edit context" description={editing?.name ?? "Update name and icon"} mobileSize="compact" desktopClassName="sm:w-[min(calc(100dvw-2rem),35rem)] sm:max-w-[35rem]" headerClassName="px-4 pb-3 pt-2 sm:px-5 sm:py-4" bodyClassName="px-4 py-4 sm:px-5" footerClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pt-4" footer={<div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={cancelEdit}>Cancel</Button><Button type="button" className="h-12 rounded-xl" disabled={!editingName.trim() || isMutating} onClick={() => void saveEdit()}>{isMutating ? "Saving..." : "Save context"}</Button></div>}>
        <div className="grid gap-4"><div className="relative"><EditIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveEdit() } if (event.key === "Escape") cancelEdit() }} className="h-12 rounded-xl pl-10" /></div><TagIconPicker tagName={editingName} value={editingIconKey} onChange={setEditingIconKey} entityLabel="Context" iconOptions={CONTEXT_ICON_OPTIONS} iconResolver={getContextIcon} desktopGridColumns={6} /></div>
      </ResponsiveDialog>
      <ResponsiveConfirmDialog open={!!deleteId} onOpenChange={(open) => !open && !isMutating && setDeleteId(null)} title="Remove context?" description="This removes the context from your available context list. Existing transactions will not be changed." confirmLabel={isMutating ? "Removing..." : "Remove context"} confirmVariant="destructive" confirmDisabled={isMutating} closeDisabled={isMutating} onConfirm={() => void deleteContext()} />
      <BottomNav />
    </div>
  )
}
