"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import type { AuthUser, Profile } from "@/lib/api/types"

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setAuthenticatedUser = useCallback((user: AuthUser) => {
    setProfile((current) => ({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      auth_provider: user.auth_provider,
      onboarding_complete: user.onboarding_complete,
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

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
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
  }, [refreshProfile])

  const signOut = useCallback(async () => {
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
