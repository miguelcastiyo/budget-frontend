import type { ApiClientCore } from "./core"

export interface MigrationStatus { migration_id: string; status: string; source_financial_revision: number; staging: { staged_count: number; expected_count: number | null; verified: boolean } }
export interface MigrationSnapshot { migration_run_id: string; source_financial_revision: number; snapshot_schema_version: string; source_manifest: { relationship_count: number }; collections: Record<string, unknown[]> }
export interface MigrationTarget { target_record_id: string; record_family: string; record_schema_version: string }
export interface MigrationTargetManifest { manifest_version: "phase5_target_manifest_v1"; snapshot_schema_version: string; source_financial_revision: number; relationship_count: number; targets: MigrationTarget[] }
export interface MigrationEnvelope { target_record_id: string; record_family: string; record_schema_version: string; envelope_version: 1; iv: string; ciphertext: string }
export interface PrivacyStatus { financial_privacy_state: string; financial_revision: number; active_migration: MigrationStatus | null; latest_migration?: MigrationStatus | null }

export function createPrivacyMigrationApi(core: ApiClientCore) {
  return {
    startMigration: () => core.request<{ migration: MigrationStatus }>("/me/privacy/migration", { method: "POST", body: "{}" }),
    getPrivacyStatus: () => core.request<PrivacyStatus>("/me/privacy"),
    getMigrationStatus: (id: string) => core.request<{ migration: MigrationStatus }>(`/me/privacy/migration/${encodeURIComponent(id)}`),
    getMigrationSnapshot: (id: string) => core.request<MigrationSnapshot>(`/me/privacy/migration/${encodeURIComponent(id)}/snapshot`),
    putMigrationManifest: (id: string, manifest: MigrationTargetManifest) => core.request(`/me/privacy/migration/${encodeURIComponent(id)}/manifest`, { method: "PUT", body: JSON.stringify(manifest) }),
    putMigrationRecord: (id: string, recordId: string, record: MigrationEnvelope) => core.request(`/me/privacy/migration/${encodeURIComponent(id)}/records/${encodeURIComponent(recordId)}`, { method: "PUT", body: JSON.stringify(record) }),
    verifyMigration: (id: string) => core.request(`/me/privacy/migration/${encodeURIComponent(id)}/verify`, { method: "POST", body: "{}" }),
    cutoverMigration: (id: string) => core.request<{ financial_privacy_state: string; migration_id: string; idempotent: boolean; cleanup_status: { cleanup_job_id: string; status: string } | null }>(`/me/privacy/migration/${encodeURIComponent(id)}/cutover`, { method: "POST", body: "{}" }),
    cancelMigration: (id: string) => core.request(`/me/privacy/migration/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}" }),
  }
}
