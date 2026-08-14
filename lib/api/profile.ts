import type { ApiClientCore } from "./core"
import type {
  AuthMethodsResponse,
  EmailChangeRequestedResponse,
  EmailChangeVerifiedResponse,
  Profile,
  GoogleAuthMethodRequest,
  PasswordAuthMethodRequest,
  RequestEmailChangeRequest,
  SetupStatus,
  UpdateOnboardingStateRequest,
  UpdateOnboardingStateResponse,
  UpdateProfileRequest,
  UpdateUserPreferencesRequest,
  UserPreferences,
  VerifyEmailChangeRequest,
} from "./types"

export function createProfileApi(core: ApiClientCore) {
  return {
    async getProfile(): Promise<Profile> {
      return core.request<Profile>("/me")
    },

    async getAuthMethods(): Promise<AuthMethodsResponse> {
      return core.request<AuthMethodsResponse>("/me/auth-methods")
    },

    async updateProfile(data: UpdateProfileRequest): Promise<Profile> {
      return core.request<Profile>("/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async getSetupStatus(): Promise<SetupStatus> {
      return core.request<SetupStatus>("/me/setup-status")
    },

    async updateOnboardingState(data: UpdateOnboardingStateRequest): Promise<UpdateOnboardingStateResponse> {
      return core.request<UpdateOnboardingStateResponse>("/me/onboarding-state", {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async updatePreferences(data: UpdateUserPreferencesRequest): Promise<UserPreferences> {
      return core.request<UserPreferences>("/me/preferences", {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async requestEmailChange(data: RequestEmailChangeRequest): Promise<EmailChangeRequestedResponse> {
      return core.request<EmailChangeRequestedResponse>("/me/email-change/request", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async verifyEmailChange(data: VerifyEmailChangeRequest): Promise<EmailChangeVerifiedResponse> {
      return core.request<EmailChangeVerifiedResponse>("/me/email-change/verify", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async connectGoogleAuthMethod(data: GoogleAuthMethodRequest): Promise<AuthMethodsResponse> {
      return core.request<AuthMethodsResponse>("/me/auth-methods/google", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async removeGoogleAuthMethod(): Promise<AuthMethodsResponse> { return core.request<AuthMethodsResponse>("/me/auth-methods/google", { method: "DELETE" }) },
    async addPasswordAuthMethod(data: PasswordAuthMethodRequest): Promise<AuthMethodsResponse> { return core.request<AuthMethodsResponse>("/me/auth-methods/password", { method: "POST", body: JSON.stringify(data) }) },
    async changePasswordAuthMethod(data: PasswordAuthMethodRequest): Promise<AuthMethodsResponse> { return core.request<AuthMethodsResponse>("/me/auth-methods/password", { method: "PATCH", body: JSON.stringify(data) }) },
    async removePasswordAuthMethod(): Promise<AuthMethodsResponse> { return core.request<AuthMethodsResponse>("/me/auth-methods/password", { method: "DELETE" }) },
  }
}
