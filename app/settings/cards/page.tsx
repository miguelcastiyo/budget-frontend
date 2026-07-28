"use client"

import { useEffect, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import type { Card as CardType } from "@/lib/api/types"
import { ArrowLeft, Check, CreditCard, MoreHorizontal, Pencil, Plus, Star, Trash2, X } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError, apiClient } from "@/lib/api/client"
import { sortCards } from "@/lib/cards"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { taxonomyFromState } from "@/lib/domain/financial/view-models"
import { createEncryptedRecordId } from "@/lib/privacy/encrypted-records/crypto"

function cardCountLabel(count: number) {
  return `${count} ${count === 1 ? "card" : "cards"}`
}

const sameCardId = (left: string, right: string) => left === right || left.split(":").pop() === right.split(":").pop()
async function createEncryptedCard(authority: ReturnType<typeof useFinancialAuthority>["authority"], name: string): Promise<CardType> { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const id = createEncryptedRecordId(); await authority.createSource("taxonomy_card", "taxonomy_card_v1", id, { id, name, is_favorite: false, is_deleted: false }); return { id, name, is_favorite: false } }
async function updateEncryptedCard(authority: ReturnType<typeof useFinancialAuthority>["authority"], cardId: string, data: { name?: string; is_favorite?: boolean }): Promise<CardType> { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const record = authority.store.values().find((item) => item.family === "taxonomy_card" && (sameCardId(item.sourceId, cardId) || sameCardId(String(item.data.id ?? ""), cardId))); if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); if (data.is_favorite) for (const other of authority.store.values().filter((item) => item.family === "taxonomy_card" && item.envelope.record_id !== record.envelope.record_id && item.data.is_favorite === true)) await authority.update(other.envelope.record_id, { ...other.data, is_favorite: false }); await authority.update(record.envelope.record_id, { ...record.data, ...data }); return { id: cardId, name: String(data.name ?? record.data.name ?? ""), is_favorite: data.is_favorite ?? record.data.is_favorite === true } }
async function deleteEncryptedCard(authority: ReturnType<typeof useFinancialAuthority>["authority"], cardId: string): Promise<void> { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const record = authority.store.values().find((item) => item.family === "taxonomy_card" && (sameCardId(item.sourceId, cardId) || sameCardId(String(item.data.id ?? ""), cardId))); if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); await authority.update(record.envelope.record_id, { ...record.data, is_deleted: true }) }

function upsertUpdatedCard(cards: CardType[], updated: CardType): CardType[] {
  const next = cards.map((card) => {
    if (card.id === updated.id) {
      return updated
    }

    if (updated.is_favorite && card.is_favorite) {
      return { ...card, is_favorite: false }
    }

    return card
  })

  return sortCards(next)
}

export default function CardsSettingsPage() {
  const financialAuthority = useFinancialAuthority()
  const [cards, setCards] = useState<CardType[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [newCardName, setNewCardName] = useState("")
  const [showNewCard, setShowNewCard] = useState(false)
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editingCard = cards.find((card) => card.id === editingId) ?? null
  const hasEditingCardChanges = editingCard ? editingName.trim() !== editingCard.name.trim() : false

  useEffect(() => {
    const loadCards = async () => {
      try {
        if (financialAuthority.mode === "encrypted") {
          if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
          const state = financialAuthority.authority.getState()
          setCards(sortCards(taxonomyFromState({ ...state, cards: state.cards.filter((item) => !item.isDeleted) }).cards))
        } else {
          const response = await apiClient.getCards()
          setCards(sortCards(response.items))
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.error.message)
        } else {
          setError("Unable to load cards")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadCards()
  }, [financialAuthority])

  const handleStartEdit = (card: CardType) => {
    setEditingId(card.id)
    setEditingName(card.name)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const updated = financialAuthority.mode === "encrypted" ? await updateEncryptedCard(financialAuthority.authority, editingId, { name: editingName.trim() }) : await apiClient.updateCard(editingId, { name: editingName.trim() })
      setCards((previous) => upsertUpdatedCard(previous, updated))
      setEditingId(null)
      setEditingName("")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to update card")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  const handleAddCard = async () => {
    const name = newCardName.trim()
    if (!name) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const created = financialAuthority.mode === "encrypted" ? await createEncryptedCard(financialAuthority.authority, name) : await apiClient.createCard({ name })
      setCards((previous) => sortCards([...previous, created]))
      setNewCardName("")
      setShowNewCard(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to create card")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteCard = async () => {
    if (!deleteCardId) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      if (financialAuthority.mode === "encrypted") await deleteEncryptedCard(financialAuthority.authority, deleteCardId)
      else await apiClient.deleteCard(deleteCardId)
      setCards((previous) => previous.filter((card) => card.id !== deleteCardId))
      setDeleteCardId(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to remove card")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleFavoriteToggle = async (card: CardType) => {
    setIsMutating(true)
    setError(null)

    try {
      const updated = financialAuthority.mode === "encrypted" ? await updateEncryptedCard(financialAuthority.authority, card.id, { is_favorite: !card.is_favorite }) : await apiClient.updateCard(card.id, { is_favorite: !card.is_favorite })
      setCards((previous) => upsertUpdatedCard(previous, updated))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError(card.is_favorite ? "Unable to clear favorite card" : "Unable to favorite card")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const openNewCardForm = () => {
    setEditingId(null)
    setEditingName("")
    setNewCardName("")
    setShowNewCard(true)
  }

  const closeNewCardForm = () => {
    setShowNewCard(false)
    setNewCardName("")
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
          <h1 className="flex-1 text-xl font-bold">Cards</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full sm:hidden"
            aria-label="Create card"
            onClick={openNewCardForm}
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button className="hidden rounded-xl sm:inline-flex" onClick={openNewCardForm}>
            <Plus className="h-4 w-4" />
            New card
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-5 pt-5">
        <p className="text-sm text-muted-foreground">
          Add your credit and debit cards to track which card you used for each transaction.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {showNewCard && (
          <Card className="p-4 border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <Input
                value={newCardName}
                onChange={(e) => setNewCardName(e.target.value)}
                placeholder="Card name (e.g., Chase Sapphire)"
                className="h-10 rounded-xl flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddCard()
                  if (e.key === "Escape") {
                    closeNewCardForm()
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                aria-label="Create card"
                onClick={() => void handleAddCard()}
                disabled={!newCardName.trim() || isMutating}
              >
                <Check className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                aria-label="Cancel new card"
                onClick={closeNewCardForm}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold">Cards</h2>
              <p className="text-xs text-muted-foreground">{isLoading ? "Loading cards" : cardCountLabel(cards.length)}</p>
            </div>
          </div>

          {isLoading && (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 p-4 sm:py-3.5">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-secondary" />
                  <div className="h-4 w-36 animate-pulse rounded-full bg-secondary" />
                  <div className="ml-auto h-9 w-9 animate-pulse rounded-full bg-secondary" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && cards.length === 0 && (
            <div className="p-5">
              <p className="font-medium">Could not load cards</p>
              <p className="mt-1 text-sm text-muted-foreground">Try refreshing the page.</p>
            </div>
          )}

          {!isLoading && !error && cards.length === 0 && (
            <div className="p-5">
              <p className="font-medium">No cards yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the cards you use so transactions can show where money was spent.
              </p>
              <Button className="mt-4 rounded-xl" onClick={openNewCardForm}>
                <Plus className="h-4 w-4" />
                New card
              </Button>
            </div>
          )}

          {!isLoading && cards.length > 0 && (
            <div className="divide-y divide-border">
              {cards.map((card) => (
                <div key={card.id} className="flex min-h-[76px] items-center gap-3 p-4 sm:min-h-[68px] sm:px-5 sm:py-3">
                  {editingId === card.id ? (
                    <>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-10 min-w-0 flex-1 rounded-xl"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSaveEdit()
                          if (e.key === "Escape") handleCancelEdit()
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Save ${card.name}`}
                        onClick={() => void handleSaveEdit()}
                        disabled={!editingName.trim() || isMutating || !hasEditingCardChanges}
                      >
                        <Check className="h-5 w-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Cancel editing ${card.name}`}
                        onClick={handleCancelEdit}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate font-medium">{card.name}</span>
                          {card.is_favorite && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              <Star className="h-3 w-3 fill-current" />
                              Favorite
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:hidden">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-full"
                          aria-label={card.is_favorite ? `Clear favorite card ${card.name}` : `Favorite card ${card.name}`}
                          onClick={() => void handleFavoriteToggle(card)}
                          disabled={isMutating}
                        >
                          <Star className={card.is_favorite ? "h-4 w-4 fill-amber-400 text-amber-500" : "h-4 w-4"} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-full"
                          aria-label={`Edit ${card.name}`}
                          onClick={() => handleStartEdit(card)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-full text-destructive hover:text-destructive"
                          aria-label={`Remove ${card.name}`}
                          onClick={() => setDeleteCardId(card.id)}
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
                              aria-label={`Card actions for ${card.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem disabled={isMutating} onClick={() => void handleFavoriteToggle(card)}>
                              <Star className={card.is_favorite ? "h-4 w-4 fill-amber-400 text-amber-500" : "h-4 w-4"} />
                              {card.is_favorite ? "Clear favorite" : "Set as favorite"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStartEdit(card)}>
                              <Pencil className="h-4 w-4" />
                              Edit card
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteCardId(card.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove card
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      <ResponsiveConfirmDialog
        open={!!deleteCardId}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setDeleteCardId(null)
          }
        }}
        title="Remove card?"
        description="This removes the card from your available card list. Existing transactions that already use this card will not be changed."
        confirmLabel={isMutating ? "Removing..." : "Remove card"}
        confirmVariant="destructive"
        confirmDisabled={isMutating}
        closeDisabled={isMutating}
        onConfirm={() => void handleDeleteCard()}
      />

      <BottomNav />
    </div>
  )
}
