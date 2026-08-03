"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { ApiError, apiClient, GLOBAL_AUTH_ERROR_EVENT } from "@/lib/api/client"
import type { AuthUser, Profile, SetupStatus, ThemePreference } from "@/lib/api/types"

interface AuthContextValue {
  profile: Profile | null
  setupStatus: SetupStatus | null
  isAuthenticated: boolean
  needsOnboarding: boolean
  isLoading: boolean
  refreshProfile: () => Promise<void>
  refreshSetupStatus: () => Promise<void>
  setProfile: (profile: Profile | null) => void
  setSetupStatus: (setupStatus: SetupStatus | null) => void
  setAuthenticatedUser: (user: AuthUser) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
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
      const [me, nextSetupStatus] = await Promise.all([
        apiClient.getProfile(),
        apiClient.getSetupStatus(),
      ])
      if (!apiClient.hasCsrfToken()) {
        await apiClient.refreshCsrfToken()
      }
      setProfile(me)
      setSetupStatus(nextSetupStatus)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setProfile(null)
        setSetupStatus(null)
        return
      }

      throw error
    }
  }, [])

  const refreshSetupStatus = useCallback(async () => {
    try {
      const nextSetupStatus = await apiClient.getSetupStatus()
      setSetupStatus(nextSetupStatus)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setProfile(null)
        setSetupStatus(null)
        return
      }

      throw error
    }
  }, [])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        await refreshProfile()
      } catch {
        if (active) {
          setProfile(null)
          setSetupStatus(null)
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
  }, [pathname, refreshProfile])

  useEffect(() => {
    const theme = profile?.user_preferences?.appearance?.theme
    if (theme) {
      applyThemePreference(theme)
      setTheme(theme)
    }
  }, [profile?.user_preferences?.appearance?.theme, setTheme])

  useEffect(() => {
    const handleGlobalAuthError = () => {
      setProfile(null)
      setSetupStatus(null)
    }

    window.addEventListener(GLOBAL_AUTH_ERROR_EVENT, handleGlobalAuthError)
    return () => window.removeEventListener(GLOBAL_AUTH_ERROR_EVENT, handleGlobalAuthError)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiClient.signOut()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error
      }
    } finally {
      setProfile(null)
      setSetupStatus(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    profile,
    setupStatus,
    isAuthenticated: !!profile,
    needsOnboarding: !!profile && !!setupStatus && !setupStatus.budget_profile_complete,
    isLoading,
    refreshProfile,
    refreshSetupStatus,
    setProfile,
    setSetupStatus,
    setAuthenticatedUser,
    signOut,
  }), [profile, setupStatus, isLoading, refreshProfile, refreshSetupStatus, setAuthenticatedUser, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return context
}
