import type { ApiClientCore } from "./core"
import type {
  ConvertAccountToGoogleRequest,
  EmailChangeRequestedResponse,
  EmailChangeVerifiedResponse,
  Profile,
  RequestEmailChangeRequest,
  SettingsSummaryResponse,
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

    async getPreferences(): Promise<UserPreferences> {
      return core.request<UserPreferences>("/me/preferences")
    },

    async updatePreferences(data: UpdateUserPreferencesRequest): Promise<UserPreferences> {
      return core.request<UserPreferences>("/me/preferences", {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async getSettingsSummary(): Promise<SettingsSummaryResponse> {
      return core.request<SettingsSummaryResponse>("/me/settings-summary")
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

    async convertAccountToGoogle(data: ConvertAccountToGoogleRequest): Promise<Profile> {
      return core.request<Profile>("/me/auth/convert-google", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
  }
}
