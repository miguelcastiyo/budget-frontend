"use client"

import { useEffect, useState } from "react"
import { ApiError, GLOBAL_API_ERROR_EVENT } from "@/lib/api/client"
import { ErrorDialog, type ErrorDialogState } from "@/components/common/error-dialog"

interface GlobalErrorProviderProps {
  children: React.ReactNode
}

function globalApiErrorState(error: ApiError): ErrorDialogState {
  return {
    title: "Something went wrong",
    message: "The request failed on the server. Try again, and use the request ID if this keeps happening.",
    requestId: error.requestId,
    status: error.status,
    code: error.error.code,
  }
}

export function GlobalErrorProvider({ children }: GlobalErrorProviderProps) {
  const [error, setError] = useState<ErrorDialogState | null>(null)

  useEffect(() => {
    const onGlobalApiError = (event: Event) => {
      const apiError = (event as CustomEvent<ApiError>).detail
      if (apiError instanceof ApiError) {
        setError(globalApiErrorState(apiError))
      }
    }

    window.addEventListener(GLOBAL_API_ERROR_EVENT, onGlobalApiError)
    return () => window.removeEventListener(GLOBAL_API_ERROR_EVENT, onGlobalApiError)
  }, [])

  return (
    <>
      {children}
      <ErrorDialog
        error={error}
        onOpenChange={(open) => {
          if (!open) {
            setError(null)
          }
        }}
      />
    </>
  )
}
