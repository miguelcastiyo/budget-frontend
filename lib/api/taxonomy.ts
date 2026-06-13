import type { ApiClientCore } from "./core"
import type { Card, CreateNamedEntityRequest, Tag, TagQuickPicksResponse } from "./types"

export function createTaxonomyApi(core: ApiClientCore) {
  return {
    async getTags(): Promise<{ items: Tag[] }> {
      return core.request<{ items: Tag[] }>("/me/tags")
    },

    async getTagQuickPicks(limit = 6): Promise<TagQuickPicksResponse> {
      const params = new URLSearchParams({
        limit: String(limit),
      })

      return core.request<TagQuickPicksResponse>(`/me/tags/quick-picks?${params.toString()}`)
    },

    async createTag(data: CreateNamedEntityRequest): Promise<Tag> {
      return core.request<Tag>("/me/tags", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async updateTag(tagId: string, data: CreateNamedEntityRequest): Promise<Tag> {
      return core.request<Tag>(`/me/tags/${tagId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async deleteTag(tagId: string): Promise<void> {
      return core.request<void>(`/me/tags/${tagId}`, {
        method: "DELETE",
      })
    },

    async getCards(): Promise<{ items: Card[] }> {
      return core.request<{ items: Card[] }>("/me/cards")
    },

    async createCard(data: CreateNamedEntityRequest): Promise<Card> {
      return core.request<Card>("/me/cards", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async updateCard(cardId: string, data: CreateNamedEntityRequest): Promise<Card> {
      return core.request<Card>(`/me/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async deleteCard(cardId: string): Promise<void> {
      return core.request<void>(`/me/cards/${cardId}`, {
        method: "DELETE",
      })
    },
  }
}
