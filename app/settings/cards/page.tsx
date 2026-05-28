"use client"

import { useEffect, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Card as CardType } from "@/lib/api/types"
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, CreditCard } from "lucide-react"
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

export default function CardsSettingsPage() {
  const [cards, setCards] = useState<CardType[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [newCardName, setNewCardName] = useState("")
  const [showNewCard, setShowNewCard] = useState(false)
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCards = async () => {
      try {
        const response = await apiClient.getCards()
        setCards(response.items)
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
  }, [])

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
      const updated = await apiClient.updateCard(editingId, { name: editingName.trim() })
      setCards((previous) => previous.map((card) => (card.id === editingId ? updated : card)))
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
      const created = await apiClient.createCard({ name })
      setCards((previous) => [...previous, created])
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
      await apiClient.deleteCard(deleteCardId)
      setCards((previous) => previous.filter((card) => card.id !== deleteCardId))
      setDeleteCardId(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to delete card")
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
          <h1 className="text-xl font-bold flex-1">Cards</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setShowNewCard(true)}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-4">
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
                    setShowNewCard(false)
                    setNewCardName("")
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={() => void handleAddCard()}
                disabled={!newCardName.trim() || isMutating}
              >
                <Check className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setShowNewCard(false)
                  setNewCardName("")
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden border-0 shadow-sm divide-y divide-border">
          {!isLoading && cards.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No cards yet.</div>
          )}

          {cards.map((card) => (
            <div key={card.id} className="flex items-center gap-3 p-4">
              {editingId === card.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-10 rounded-xl flex-1"
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
                    onClick={() => void handleSaveEdit()}
                    disabled={!editingName.trim() || isMutating}
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
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className="flex-1 font-medium">{card.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => handleStartEdit(card)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={() => setDeleteCardId(card.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </Card>
      </main>

      <AlertDialog open={!!deleteCardId} onOpenChange={(open) => !open && setDeleteCardId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete card?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the card from your list. Existing transactions with this card will keep their current card.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteCard()}
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
