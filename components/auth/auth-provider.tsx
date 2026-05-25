"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { ApiError, apiClient } from "@/lib/api/client"
import { isLocalMockMode } from "@/lib/local-dev"
import { mockProfile } from "@/lib/mock-data"
import type { AuthUser, Profile, ThemePreference } from "@/lib/api/types"

const CSRF_STORAGE_KEY = "budget.csrf_token"
const PUBLIC_PREFIXES = ["/invite/", "/password-reset"]

interface AuthContextValue {
  profile: Profile | null
  isAuthenticated: boolean
  needsOnboarding: boolean
  isLoading: boolean
  refreshProfile: () => Promise<void>
  setProfile: (profile: Profile | null) => void
  setAuthenticatedUser: (user: AuthUser) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function isPublicPath(pathname: string): boolean {
  if (pathname === "/sign-in") {
    return true
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function applyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
    root.style.colorScheme = "dark"
    return
  }

  if (theme === "light") {
    root.classList.remove("dark")
    root.style.colorScheme = "light"
    return
  }

  root.classList.remove("dark")
  root.style.removeProperty("color-scheme")
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setAuthenticatedUser = useCallback((user: AuthUser) => {
    setProfile((current) => ({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      auth_provider: user.auth_provider,
      role: user.role,
      onboarding_complete: user.onboarding_complete,
      user_preferences: user.user_preferences,
      email_verified: current?.email_verified ?? true,
      created_at: current?.created_at ?? "",
    }))
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const me = await apiClient.getProfile()
      setProfile(me)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setProfile(null)
        return
      }

      throw error
    }
  }, [])

  const hasStoredSessionHint = useCallback(() => {
    if (typeof window === "undefined") {
      return false
    }

    return Boolean(window.localStorage.getItem(CSRF_STORAGE_KEY))
  }, [])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      if (isLocalMockMode()) {
        if (active) {
          setProfile(mockProfile)
          setIsLoading(false)
        }
        return
      }

      if (isPublicPath(pathname) && !hasStoredSessionHint()) {
        if (active) {
          setProfile(null)
          setIsLoading(false)
        }
        return
      }

      try {
        await refreshProfile()
      } catch {
        if (active) {
          setProfile(null)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [hasStoredSessionHint, pathname, refreshProfile])

  useEffect(() => {
    const theme = profile?.user_preferences?.appearance?.theme
    if (theme) {
      applyThemePreference(theme)
      setTheme(theme)
    }
  }, [profile?.user_preferences?.appearance?.theme, setTheme])

  const signOut = useCallback(async () => {
    if (isLocalMockMode()) {
      setProfile(null)
      return
    }

    try {
      await apiClient.signOut()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error
      }
    } finally {
      setProfile(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    profile,
    isAuthenticated: !!profile,
    needsOnboarding: !!profile && !profile.onboarding_complete,
    isLoading,
    refreshProfile,
    setProfile,
    setAuthenticatedUser,
    signOut,
  }), [profile, isLoading, refreshProfile, setAuthenticatedUser, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return context
}
