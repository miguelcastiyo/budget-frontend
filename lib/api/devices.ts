import type { ApiClientCore } from "./core"

export interface DeviceSession { id: string; device_id: string; client_type: string; label: string; created_at: string; last_seen_at: string | null; expires_at: string; revoked_at: string | null; is_current: boolean; status: "active" | "revoked"; quick_unlock: { status: "enabled" | "not_enabled" } }

export function createDevicesApi(core: ApiClientCore) {
  return {
    getDevices: () => core.request<{ items: DeviceSession[] }>("/me/devices"),
    revokeDevice: (id: string) => core.request<{ status: "removed"; device_id: string; current_device: boolean }>(`/me/devices/${encodeURIComponent(id)}`, { method: "DELETE" }),
  }
}
