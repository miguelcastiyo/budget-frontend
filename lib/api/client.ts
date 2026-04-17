import type {
  Profile,
  UserPreferences,
  UpdateProfileRequest,
  UpdateUserPreferencesRequest,
  AuthSessionResponse,
  PasswordSignInRequest,
  GoogleSignInRequest,
  Tag,
  Card,
  CreateNamedEntityRequest,
  RecurringExpensesResponse,
  CreateRecurringExpenseRequest,
  UpdateRecurringExpenseRequest,
  BudgetSettings,
  BudgetSettingsPercentInput,
  BudgetSettingsAmountInput,
  Transaction,
  TransactionsPage,
  TransactionFilters,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TagMetricsResponse,
  CategoryMetricsResponse,
  DashboardResponse,
  InsightsMetricsResponse,
  MasterApiKeyMetadata,
  CreateMasterApiKeyRequest,
  CreateMasterApiKeyResponse,
  CsvImportResponse,
  CreateInviteRequest,
  InviteResponse,
  AcceptInvitePasswordRequest,
  AcceptInviteGoogleRequest,
  RequestEmailChangeRequest,
  EmailChangeRequestedResponse,
  VerifyEmailChangeRequest,
  EmailChangeVerifiedResponse,
  ConvertAccountToGoogleRequest,
  ErrorEnvelope,
} from "./types"

const API_BASE = "/api/v1"
const CSRF_STORAGE_KEY = "budget.csrf_token"

class ApiClient {
  private csrfToken: string | null = null

  private readCsrfToken(): string | null {
    if (typeof window === "undefined") {
      return null
    }
    return window.localStorage.getItem(CSRF_STORAGE_KEY)
  }

  private writeCsrfToken(token: string | null) {
    if (typeof window === "undefined") {
      return
    }

    if (token) {
      window.localStorage.setItem(CSRF_STORAGE_KEY, token)
      return
    }

    window.localStorage.removeItem(CSRF_STORAGE_KEY)
  }

  private ensureCsrfTokenLoaded() {
    if (this.csrfToken !== null) {
      return
    }

    this.csrfToken = this.readCsrfToken()
  }

  setCsrfToken(token: string | null) {
    this.csrfToken = token
    this.writeCsrfToken(token)
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    this.ensureCsrfTokenLoaded()

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    if (this.csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(options.method || "GET")) {
      ;(headers as Record<string, string>)["X-CSRF-Token"] = this.csrfToken
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.setCsrfToken(null)
      }

      let message = `Request failed with status ${response.status}`
      let details: { field: string; message: string }[] | undefined
      let code: ErrorEnvelope["error"]["code"] = "INTERNAL_ERROR"

      try {
        const error: ErrorEnvelope = await response.json()
        message = error.error.message
        details = error.error.details
        code = error.error.code
      } catch {
        // Keep fallback message for non-JSON errors.
      }

      throw new ApiError(response.status, {
        code,
        message,
        details,
      })
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  // Auth
  async signInWithPassword(data: PasswordSignInRequest): Promise<AuthSessionResponse> {
    const result = await this.request<AuthSessionResponse>("/auth/sessions/password", {
      method: "POST",
      body: JSON.stringify(data),
    })
    this.setCsrfToken(result.session.csrf_token)
    return result
  }

  async signInWithGoogle(data: GoogleSignInRequest): Promise<AuthSessionResponse> {
    const result = await this.request<AuthSessionResponse>("/auth/sessions/google", {
      method: "POST",
      body: JSON.stringify(data),
    })
    this.setCsrfToken(result.session.csrf_token)
    return result
  }

  async signOut(): Promise<void> {
    await this.request<void>("/auth/sessions/current", {
      method: "DELETE",
    })
    this.setCsrfToken(null)
  }

  async createInvite(data: CreateInviteRequest): Promise<InviteResponse> {
    return this.request<InviteResponse>("/auth/invitations", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async acceptInvitePassword(data: AcceptInvitePasswordRequest): Promise<AuthSessionResponse> {
    const result = await this.request<AuthSessionResponse>("/auth/invitations/accept-password", {
      method: "POST",
      body: JSON.stringify(data),
    })
    this.setCsrfToken(result.session.csrf_token)
    return result
  }

  async acceptInviteGoogle(data: AcceptInviteGoogleRequest): Promise<AuthSessionResponse> {
    const result = await this.request<AuthSessionResponse>("/auth/invitations/accept-google", {
      method: "POST",
      body: JSON.stringify(data),
    })
    this.setCsrfToken(result.session.csrf_token)
    return result
  }

  // Profile
  async getProfile(): Promise<Profile> {
    return this.request<Profile>("/me")
  }

  async updateProfile(data: UpdateProfileRequest): Promise<Profile> {
    return this.request<Profile>("/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async getPreferences(): Promise<UserPreferences> {
    return this.request<UserPreferences>("/me/preferences")
  }

  async updatePreferences(data: UpdateUserPreferencesRequest): Promise<UserPreferences> {
    return this.request<UserPreferences>("/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async requestEmailChange(data: RequestEmailChangeRequest): Promise<EmailChangeRequestedResponse> {
    return this.request<EmailChangeRequestedResponse>("/me/email-change/request", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async verifyEmailChange(data: VerifyEmailChangeRequest): Promise<EmailChangeVerifiedResponse> {
    return this.request<EmailChangeVerifiedResponse>("/me/email-change/verify", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async convertAccountToGoogle(data: ConvertAccountToGoogleRequest): Promise<Profile> {
    return this.request<Profile>("/me/auth/convert-google", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  // Tags
  async getTags(): Promise<{ items: Tag[] }> {
    return this.request<{ items: Tag[] }>("/me/tags")
  }

  async createTag(data: CreateNamedEntityRequest): Promise<Tag> {
    return this.request<Tag>("/me/tags", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateTag(tagId: string, data: CreateNamedEntityRequest): Promise<Tag> {
    return this.request<Tag>(`/me/tags/${tagId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteTag(tagId: string): Promise<void> {
    return this.request<void>(`/me/tags/${tagId}`, {
      method: "DELETE",
    })
  }

  // Cards
  async getCards(): Promise<{ items: Card[] }> {
    return this.request<{ items: Card[] }>("/me/cards")
  }

  async createCard(data: CreateNamedEntityRequest): Promise<Card> {
    return this.request<Card>("/me/cards", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateCard(cardId: string, data: CreateNamedEntityRequest): Promise<Card> {
    return this.request<Card>(`/me/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteCard(cardId: string): Promise<void> {
    return this.request<void>(`/me/cards/${cardId}`, {
      method: "DELETE",
    })
  }

  // Recurring expenses
  async getRecurringExpenses(month?: string): Promise<RecurringExpensesResponse> {
    const params = new URLSearchParams()
    if (month) {
      params.set("month", month)
    }
    const query = params.toString()
    return this.request<RecurringExpensesResponse>(`/me/recurring-expenses${query ? `?${query}` : ""}`)
  }

  async createRecurringExpense(data: CreateRecurringExpenseRequest): Promise<void> {
    await this.request("/me/recurring-expenses", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateRecurringExpense(recurringExpenseId: string, data: UpdateRecurringExpenseRequest): Promise<void> {
    await this.request(`/me/recurring-expenses/${recurringExpenseId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteRecurringExpense(recurringExpenseId: string): Promise<void> {
    await this.request(`/me/recurring-expenses/${recurringExpenseId}`, {
      method: "DELETE",
    })
  }

  // Budget Settings
  async getBudgetSettings(): Promise<BudgetSettings> {
    return this.request<BudgetSettings>("/me/budget-settings")
  }

  async updateBudgetSettings(
    data: BudgetSettingsPercentInput | BudgetSettingsAmountInput
  ): Promise<BudgetSettings> {
    return this.request<BudgetSettings>("/me/budget-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  // Transactions
  async getTransactions(filters?: TransactionFilters): Promise<TransactionsPage> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, String(value))
        }
      })
    }
    const query = params.toString()
    return this.request<TransactionsPage>(`/me/transactions${query ? `?${query}` : ""}`)
  }

  async createTransaction(data: CreateTransactionRequest): Promise<Transaction> {
    return this.request<Transaction>("/me/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateTransaction(
    transactionId: string,
    data: UpdateTransactionRequest
  ): Promise<Transaction> {
    return this.request<Transaction>(`/me/transactions/${transactionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    return this.request<void>(`/me/transactions/${transactionId}`, {
      method: "DELETE",
    })
  }

  // Metrics
  async getTagMetrics(month: string): Promise<TagMetricsResponse> {
    return this.request<TagMetricsResponse>(`/me/metrics/tags?month=${month}`)
  }

  async getCategoryMetrics(month: string): Promise<CategoryMetricsResponse> {
    return this.request<CategoryMetricsResponse>(`/me/metrics/categories?month=${month}`)
  }

  async getDashboard(month: string): Promise<DashboardResponse> {
    return this.request<DashboardResponse>(`/me/dashboard?month=${month}`)
  }

  async getInsightsMetrics(dateFrom: string, dateTo: string): Promise<InsightsMetricsResponse> {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    })

    return this.request<InsightsMetricsResponse>(`/me/metrics/insights?${params.toString()}`)
  }

  // Import/Export
  async exportTransactions(filters?: TransactionFilters): Promise<Blob> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, String(value))
        }
      })
    }
    const query = params.toString()
    const response = await fetch(
      `${API_BASE}/me/transactions/export.csv${query ? `?${query}` : ""}`,
      { credentials: "include" }
    )

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`
      let details: { field: string; message: string }[] | undefined
      let code: ErrorEnvelope["error"]["code"] = "INTERNAL_ERROR"

      try {
        const error: ErrorEnvelope = await response.json()
        message = error.error.message
        details = error.error.details
        code = error.error.code
      } catch {
        // Keep fallback message for non-JSON errors.
      }

      throw new ApiError(response.status, {
        code,
        message,
        details,
      })
    }

    return response.blob()
  }

  async importTransactions(file: File, mode: "dry_run" | "commit"): Promise<CsvImportResponse> {
    this.ensureCsrfTokenLoaded()

    const formData = new FormData()
    formData.append("file", file)
    formData.append("mode", mode)

    const headers: HeadersInit = {}
    if (this.csrfToken) {
      headers["X-CSRF-Token"] = this.csrfToken
    }

    const response = await fetch(`${API_BASE}/me/transactions/import.csv`, {
      method: "POST",
      body: formData,
      headers,
      credentials: "include",
    })

    if (!response.ok) {
      const error: ErrorEnvelope = await response.json()
      throw new ApiError(response.status, error.error)
    }

    return response.json()
  }

  // API Keys
  async getMasterApiKeys(): Promise<{ items: MasterApiKeyMetadata[] }> {
    return this.request<{ items: MasterApiKeyMetadata[] }>("/me/master-api-keys")
  }

  async createMasterApiKey(data: CreateMasterApiKeyRequest): Promise<CreateMasterApiKeyResponse> {
    return this.request<CreateMasterApiKeyResponse>("/me/master-api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async deleteMasterApiKey(apiKeyId: string): Promise<void> {
    return this.request<void>(`/me/master-api-keys/${apiKeyId}`, {
      method: "DELETE",
    })
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public error: {
      code: string
      message: string
      details?: { field: string; message: string }[]
    }
  ) {
    super(error.message)
    this.name = "ApiError"
  }
}

export const apiClient = new ApiClient()
