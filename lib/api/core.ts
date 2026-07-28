import type { ErrorEnvelope } from "./types"
import { assertLegacyMutationAllowed } from "../privacy/encrypted-authority/routing"

const API_BASE = "/api/v1"
const CSRF_STORAGE_KEY = "budget.csrf_token"

export class ApiError extends Error {
  constructor(
    public status: number,
    public error: {
      code: string
      message: string
      details?: { field: string; message: string }[]
    },
    public requestId?: string
  ) {
    super(error.message)
    this.name = "ApiError"
  }
}

export const GLOBAL_API_ERROR_EVENT = "budget:global-api-error"

function notifyGlobalApiError(error: ApiError) {
  if (typeof window === "undefined" || error.status < 500) {
    return
  }

  window.dispatchEvent(
    new CustomEvent<ApiError>(GLOBAL_API_ERROR_EVENT, {
      detail: error,
    })
  )
}

export class ApiClientCore {
  private csrfToken: string | null = null

  private async apiErrorFromResponse(response: Response): Promise<ApiError> {
    const requestId = response.headers.get("X-Request-ID") ?? undefined

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

    const apiError = new ApiError(
      response.status,
      {
        code,
        message,
        details,
      },
      requestId
    )
    notifyGlobalApiError(apiError)
    return apiError
  }

  private async throwApiError(response: Response): Promise<never> {
    throw await this.apiErrorFromResponse(response)
  }

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

  private authorizedHeaders(method = "GET", headers: HeadersInit = {}): HeadersInit {
    const nextHeaders: HeadersInit = { ...headers }

    if (this.csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      ;(nextHeaders as Record<string, string>)["X-CSRF-Token"] = this.csrfToken
    }

    return nextHeaders
  }

  setCsrfToken(token: string | null) {
    this.csrfToken = token
    this.writeCsrfToken(token)
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    this.ensureCsrfTokenLoaded()

    const method = options.method || "GET"
    assertLegacyMutationAllowed(endpoint, method)
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...this.authorizedHeaders(method, options.headers),
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
      await this.throwApiError(response)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  async requestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    this.ensureCsrfTokenLoaded()

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: this.authorizedHeaders(options.method || "GET", options.headers),
      credentials: "include",
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.setCsrfToken(null)
      }
      await this.throwApiError(response)
    }

    return response.blob()
  }

  async requestFormData<T>(endpoint: string, formData: FormData, options: RequestInit = {}): Promise<T> {
    this.ensureCsrfTokenLoaded()
    assertLegacyMutationAllowed(endpoint, options.method || "POST")

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      method: options.method || "POST",
      body: formData,
      headers: this.authorizedHeaders(options.method || "POST", options.headers),
      credentials: "include",
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.setCsrfToken(null)
      }
      await this.throwApiError(response)
    }

    return response.json()
  }
}
