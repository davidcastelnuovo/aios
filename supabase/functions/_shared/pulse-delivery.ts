/**
 * Per-recipient campaign pulse WhatsApp delivery planning.
 * Campaigners: client_team assignments. Team managers: managed agencies.
 */

import {
  filterPulseRowsByClientIds,
  isPulseDeliveryExcludedPhone,
  isPulseDeliveryExcludedRecipient,
} from './campaign-pulse.ts'
import { normalizeNotifyPhone } from './carmen-notify-target.ts'

export type PulseDeliveryRole = 'campaigner' | 'team_manager'

export type PulseDeliveryPlan = {
  key: string
  role: PulseDeliveryRole
  name: string
  phone: string
  clientIds: string[]
}

export type PulseCampaignerMissingPhone = {
  campaignerId: string
  name: string
  clientCount: number
}

type SnapshotLike = { client_id: string; agency_id?: string | null }

type CampaignerLike = { id: string; full_name: string | null; phone: string | null }

type ClientTeamLink = { campaigner_id: string; client_id: string }

type TeamManagerLike = {
  user_id: string
  full_name: string | null
  phone: string | null
  agency_ids: string[]
}

/** Message David reviews before a scoped digest goes to a campaigner / manager. */
export function buildPulsePreviewMessage(recipientName: string, digest: string): string {
  return [
    `*תצוגה מקדימה — בדיקת דופק ל${recipientName}*`,
    'לפני שליחה:',
    '',
    digest,
  ].join('\n')
}

/** Campaigners assigned pulse clients but missing a WhatsApp phone. */
export function findCampaignersMissingPulsePhone(
  snapshots: SnapshotLike[],
  links: ClientTeamLink[],
  campaigners: CampaignerLike[],
  tenantSlug?: string | null,
): PulseCampaignerMissingPhone[] {
  const snapshotClientIds = new Set(snapshots.map((row) => row.client_id))
  const clientsByCampaigner = new Map<string, Set<string>>()
  for (const link of links) {
    if (!snapshotClientIds.has(link.client_id)) continue
    const set = clientsByCampaigner.get(link.campaigner_id) || new Set<string>()
    set.add(link.client_id)
    clientsByCampaigner.set(link.campaigner_id, set)
  }

  const missing: PulseCampaignerMissingPhone[] = []
  for (const campaigner of campaigners) {
    if (isPulseDeliveryExcludedRecipient(campaigner.full_name)) continue
    const clientIds = clientsByCampaigner.get(campaigner.id)
    if (!clientIds?.size) continue
    const phone = normalizeNotifyPhone(campaigner.phone)
    if (isPulseDeliveryExcludedPhone(phone, tenantSlug)) continue
    if (phone) continue
    missing.push({
      campaignerId: campaigner.id,
      name: campaigner.full_name || 'קמפיינר',
      clientCount: clientIds.size,
    })
  }
  return missing
}

/** Alert the tenant pulse manager (Felix on DMM) to add missing campaigner phones. */
export function buildPulseMissingPhoneAlert(
  campaigners: PulseCampaignerMissingPhone[],
  options?: { tenantLabel?: string | null },
): string {
  if (!campaigners.length) return ''
  const tenantLine = options?.tenantLabel ? `\n_${options.tenantLabel}_` : ''
  return [
    '*בדיקת דופק — חסר טלפון WhatsApp לקמפיינר*',
    'לא ניתן לשלוח דופק scoped. הוסף/עדכן מספר בכרטיס הקמפיינר:',
    '',
    ...campaigners.map((c) => `• ${c.name} (${c.clientCount} לקוחות בדופק)`),
    tenantLine,
    '',
    'AIOS → צוות → קמפיינרים',
  ].filter((line) => line !== '').join('\n')
}

export function planCampaignerPulseDeliveries(
  snapshots: SnapshotLike[],
  links: ClientTeamLink[],
  campaigners: CampaignerLike[],
  tenantSlug?: string | null,
): PulseDeliveryPlan[] {
  const snapshotClientIds = new Set(snapshots.map((row) => row.client_id))
  const clientsByCampaigner = new Map<string, Set<string>>()
  for (const link of links) {
    if (!snapshotClientIds.has(link.client_id)) continue
    const set = clientsByCampaigner.get(link.campaigner_id) || new Set<string>()
    set.add(link.client_id)
    clientsByCampaigner.set(link.campaigner_id, set)
  }

  const plans: PulseDeliveryPlan[] = []
  for (const campaigner of campaigners) {
    if (isPulseDeliveryExcludedRecipient(campaigner.full_name)) continue
    const phone = normalizeNotifyPhone(campaigner.phone)
    if (isPulseDeliveryExcludedPhone(phone, tenantSlug)) continue
    const clientIds = Array.from(clientsByCampaigner.get(campaigner.id) || [])
    if (!phone || !clientIds.length) continue
    plans.push({
      key: `campaigner:${campaigner.id}`,
      role: 'campaigner',
      name: campaigner.full_name || 'קמפיינר',
      phone,
      clientIds,
    })
  }
  return plans
}

export function planTeamManagerPulseDeliveries(
  snapshots: SnapshotLike[],
  managers: TeamManagerLike[],
  tenantSlug?: string | null,
): PulseDeliveryPlan[] {
  const plans: PulseDeliveryPlan[] = []
  for (const manager of managers) {
    if (isPulseDeliveryExcludedRecipient(manager.full_name)) continue
    const phone = normalizeNotifyPhone(manager.phone)
    if (isPulseDeliveryExcludedPhone(phone, tenantSlug)) continue
    if (!phone || !manager.agency_ids.length) continue
    const agencySet = new Set(manager.agency_ids)
    const clientIds = snapshots
      .filter((row) => row.agency_id && agencySet.has(row.agency_id))
      .map((row) => row.client_id)
    if (!clientIds.length) continue
    plans.push({
      key: `manager:${manager.user_id}`,
      role: 'team_manager',
      name: manager.full_name || 'מנהל צוות',
      phone,
      clientIds,
    })
  }
  return plans
}

/** Merge plans that share a phone (union client ids). Team-manager scope wins on role label. */
export function mergePulseDeliveryPlans(plans: PulseDeliveryPlan[]): PulseDeliveryPlan[] {
  const byPhone = new Map<string, PulseDeliveryPlan>()
  for (const plan of plans) {
    const phone = normalizeNotifyPhone(plan.phone)
    if (!phone) continue
    const prev = byPhone.get(phone)
    if (!prev) {
      byPhone.set(phone, { ...plan, phone, clientIds: [...new Set(plan.clientIds)] })
      continue
    }
    prev.clientIds = [...new Set([...prev.clientIds, ...plan.clientIds])]
    if (plan.role === 'team_manager') prev.role = 'team_manager'
    if (!prev.name && plan.name) prev.name = plan.name
  }
  return Array.from(byPhone.values())
}

/** Manual trial: deliver scoped pulse only to campaigners whose name matches. */
export function filterPulsePlansByCampaignerName(
  plans: PulseDeliveryPlan[],
  nameFilter: string,
): PulseDeliveryPlan[] {
  const needle = String(nameFilter || '').trim()
  if (!needle) return plans
  return plans.filter((plan) => {
    if (plan.role !== 'campaigner') return false
    const name = String(plan.name || '').trim()
    return name === needle || name.includes(needle) || needle.includes(name)
  })
}

export function filterMissingPhoneCampaignersByName<T extends { name: string }>(
  campaigners: T[],
  nameFilter: string | null | undefined,
): T[] {
  const needle = String(nameFilter || '').trim()
  if (!needle) return campaigners
  return campaigners.filter((row) => {
    const name = String(row.name || '').trim()
    return name === needle || name.includes(needle) || needle.includes(name)
  })
}

export function scopeSnapshotsForPlan<T extends { client_id: string }>(
  snapshots: T[],
  plan: PulseDeliveryPlan,
): T[] {
  return filterPulseRowsByClientIds(snapshots, plan.clientIds)
}
