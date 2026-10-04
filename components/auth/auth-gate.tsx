"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/components/auth/auth-provider"
import { isPublicPath } from "@/lib/auth-routes"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  const publicPath = isPublicPath(pathname)

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!publicPath && !isAuthenticated) {
      router.replace("/sign-in")
      return
    }

    if (pathname === "/sign-in" && isAuthenticated) {
      const returnTo = new URLSearchParams(window.location.search).get("returnTo")
      const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/"
      router.replace(safeReturnTo)
    }
  }, [isAuthenticated, isLoading, pathname, publicPath, router])

  if (isLoading && !publicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!isLoading && !publicPath && !isAuthenticated) {
    return null
  }

  if (!isLoading && pathname === "/sign-in" && isAuthenticated) {
    return null
  }

  return <>{children}</>
}
