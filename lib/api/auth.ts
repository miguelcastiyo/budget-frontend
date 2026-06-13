import type {
  AcceptInviteGoogleRequest,
  AcceptInvitePasswordRequest,
  AuthSessionResponse,
  CreateInviteRequest,
  GoogleSignInRequest,
  InvitePreviewResponse,
  InviteResponse,
  InvitesResponse,
  PasswordResetConfirmRequest,
  PasswordResetConfirmedResponse,
  PasswordResetRequest,
  PasswordResetRequestedResponse,
  PasswordSignInRequest,
} from "./types"
import type { ApiClientCore } from "./core"

export function createAuthApi(core: ApiClientCore) {
  return {
    async signInWithPassword(data: PasswordSignInRequest): Promise<AuthSessionResponse> {
      const result = await core.request<AuthSessionResponse>("/auth/sessions/password", {
        method: "POST",
        body: JSON.stringify(data),
      })
      core.setCsrfToken(result.session.csrf_token)
      return result
    },

    async signInWithGoogle(data: GoogleSignInRequest): Promise<AuthSessionResponse> {
      const result = await core.request<AuthSessionResponse>("/auth/sessions/google", {
        method: "POST",
        body: JSON.stringify(data),
      })
      core.setCsrfToken(result.session.csrf_token)
      return result
    },

    async signOut(): Promise<void> {
      await core.request<void>("/auth/sessions/current", {
        method: "DELETE",
      })
      core.setCsrfToken(null)
    },

    async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetRequestedResponse> {
      return core.request<PasswordResetRequestedResponse>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<PasswordResetConfirmedResponse> {
      return core.request<PasswordResetConfirmedResponse>("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async createInvite(data: CreateInviteRequest): Promise<InviteResponse> {
      return core.request<InviteResponse>("/auth/invitations", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async getInvites(): Promise<InvitesResponse> {
      return core.request<InvitesResponse>("/auth/invitations")
    },

    async getInvitePreview(inviteToken: string): Promise<InvitePreviewResponse> {
      return core.request<InvitePreviewResponse>(`/auth/invitations/preview?invite_token=${encodeURIComponent(inviteToken)}`)
    },

    async acceptInvitePassword(data: AcceptInvitePasswordRequest): Promise<AuthSessionResponse> {
      const result = await core.request<AuthSessionResponse>("/auth/invitations/accept-password", {
        method: "POST",
        body: JSON.stringify(data),
      })
      core.setCsrfToken(result.session.csrf_token)
      return result
    },

    async acceptInviteGoogle(data: AcceptInviteGoogleRequest): Promise<AuthSessionResponse> {
      const result = await core.request<AuthSessionResponse>("/auth/invitations/accept-google", {
        method: "POST",
        body: JSON.stringify(data),
      })
      core.setCsrfToken(result.session.csrf_token)
      return result
    },
  }
}
