import type { ErrorEnvelope } from "./types"

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
export const GLOBAL_AUTH_ERROR_EVENT = "budget:global-auth-error"

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

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key === CSRF_STORAGE_KEY) {
          this.csrfToken = event.newValue
        }
      })
    }
  }

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
    if (apiError.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<ApiError>(GLOBAL_AUTH_ERROR_EVENT, { detail: apiError }))
    }
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

  hasCsrfToken(): boolean {
    this.ensureCsrfTokenLoaded()
    return this.csrfToken !== null && this.csrfToken !== ""
  }

  async refreshCsrfToken(force = false): Promise<string> {
    this.ensureCsrfTokenLoaded()
    if (!force && this.hasCsrfToken()) {
      return this.csrfToken as string
    }

    const response = await fetch(`${API_BASE}/auth/sessions/current`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) {
      await this.throwApiError(response)
    }

    const result = await response.json() as { csrf_token?: string }
    if (!result.csrf_token) {
      throw new Error("CSRF_TOKEN_REFRESH_FAILED")
    }
    this.setCsrfToken(result.csrf_token)
    return result.csrf_token
  }

  private isCsrfFailure(error: ApiError, method: string): boolean {
    if (error.status !== 403 || !["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return false
    }

    const text = `${error.error.code} ${error.error.message}`.toLowerCase()
    return text.includes("csrf")
  }

  async request<T>(endpoint: string, options: RequestInit = {}, allowCsrfRetry = true): Promise<T> {
    this.ensureCsrfTokenLoaded()

    const method = options.method || "GET"
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
      const error = await this.apiErrorFromResponse(response)
      if (allowCsrfRetry && this.isCsrfFailure(error, method)) {
        try {
          await this.refreshCsrfToken(true)
          return this.request<T>(endpoint, options, false)
        } catch {
          // Preserve the original write failure if token recovery also fails.
        }
      }
      throw error
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

  async requestFormData<T>(endpoint: string, formData: FormData, options: RequestInit = {}, allowCsrfRetry = true): Promise<T> {
    this.ensureCsrfTokenLoaded()

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
      const error = await this.apiErrorFromResponse(response)
      if (allowCsrfRetry && this.isCsrfFailure(error, options.method || "POST")) {
        try {
          await this.refreshCsrfToken(true)
          return this.requestFormData<T>(endpoint, formData, options, false)
        } catch {
          // Preserve the original write failure if token recovery also fails.
        }
      }
      throw error
    }

    return response.json()
  }
}
