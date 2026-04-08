/**
 * DMM Agency CRM — Health Score Engine
 *
 * Calculates a 0–100 health score for each client based on:
 *  - Communication status & recency
 *  - Performance (ads) trend (7d vs 30d)
 *  - SEO monthly status
 *
 * Also produces a list of active Flags and an overall traffic-light status.
 */

export type OverallStatus = 'green' | 'yellow' | 'red';

export type FlagKey =
  | 'sensitive'
  | 'complaint'
  | 'performance_medium_drop'
  | 'performance_significant_drop'
  | 'performance_sharp_drop'
  | 'no_touch_campaign'
  | 'drop_no_action'
  | 'seo_stable'
  | 'seo_down'
  | 'no_communication_30d'
  | 'no_communication_45d'
  | 'seo_no_up_2months';

export interface HealthInput {
  /** Latest communication log status */
  communicationStatus: 'normal' | 'sensitive' | 'complaint' | null;
  /** Days since last communication log entry */
  daysSinceLastCommunication: number | null;
  /** Services the client has: 'performance' | 'seo' | 'social' */
  services: string[];
  /** % change in leads/results: negative = drop. e.g. -35 means 35% drop */
  performanceChangePct: number | null;
  /** Days since last campaign edit/touch (null = unknown / no data) */
  daysSinceLastCampaignTouch: number | null;
  /** Last 3 months of SEO status, most recent first */
  seoHistory: Array<'up' | 'stable' | 'down'>;
}

export interface HealthResult {
  score: number;
  status: OverallStatus;
  flags: FlagKey[];
}

export function calculateHealthScore(input: HealthInput): HealthResult {
  let score = 100;
  const flags: FlagKey[] = [];

  const hasPerformance = input.services.includes('performance');
  const hasSeo = input.services.includes('seo');

  // ─── Communication ────────────────────────────────────────────
  if (input.communicationStatus === 'sensitive') {
    score -= 20;
    flags.push('sensitive');
  } else if (input.communicationStatus === 'complaint') {
    score -= 50;
    flags.push('complaint');
  }

  if (input.daysSinceLastCommunication !== null) {
    if (input.daysSinceLastCommunication >= 45) {
      score -= 20;
      flags.push('no_communication_45d');
    } else if (input.daysSinceLastCommunication >= 30) {
      score -= 10;
      flags.push('no_communication_30d');
    }
  }

  // ─── Performance ──────────────────────────────────────────────
  if (hasPerformance && input.performanceChangePct !== null) {
    const drop = input.performanceChangePct; // negative = drop

    if (drop <= -45) {
      score -= 30;
      flags.push('performance_sharp_drop');
    } else if (drop <= -30) {
      score -= 20;
      flags.push('performance_significant_drop');
    } else if (drop <= -15) {
      score -= 10;
      flags.push('performance_medium_drop');
    }

    // Extra penalty: significant/sharp drop + no campaign touch
    const noTouch =
      input.daysSinceLastCampaignTouch !== null &&
      input.daysSinceLastCampaignTouch >= 3;

    if (noTouch && drop <= -30) {
      score -= 10;
      flags.push('drop_no_action');
    }

    if (noTouch && !flags.includes('drop_no_action')) {
      flags.push('no_touch_campaign');
    }
  }

  // ─── SEO ──────────────────────────────────────────────────────
  if (hasSeo && input.seoHistory.length > 0) {
    const latest = input.seoHistory[0];

    if (latest === 'down') {
      score -= 25;
      flags.push('seo_down');
    } else if (latest === 'stable') {
      score -= 10;
      flags.push('seo_stable');
    }
    // 'up' → no penalty

    // 2 months without 'up'
    const last2 = input.seoHistory.slice(0, 2);
    if (last2.length === 2 && last2.every((s) => s !== 'up')) {
      score -= 30;
      if (!flags.includes('seo_no_up_2months')) {
        flags.push('seo_no_up_2months');
      }
    }
  }

  // ─── Clamp & Status ───────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  let status: OverallStatus;
  if (score >= 80) status = 'green';
  else if (score >= 60) status = 'yellow';
  else status = 'red';

  return { score, status, flags };
}

// ─── Display helpers ──────────────────────────────────────────

export const FLAG_LABELS: Record<FlagKey, string> = {
  sensitive: 'רגיש',
  complaint: 'תלונה',
  performance_medium_drop: 'ירידה בינונית',
  performance_significant_drop: 'ירידה משמעותית',
  performance_sharp_drop: 'ירידה חדה',
  no_touch_campaign: 'לא נגעו בקמפיין',
  drop_no_action: 'ירידה + אין טיפול',
  seo_stable: 'SEO יציב',
  seo_down: 'SEO ירידה',
  no_communication_30d: 'אין תקשורת 30+ יום',
  no_communication_45d: 'אין תקשורת 45+ יום',
  seo_no_up_2months: 'SEO – 2 חודשים ללא עלייה',
};

export const FLAG_COLORS: Record<FlagKey, string> = {
  sensitive: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  complaint: 'bg-red-100 text-red-800 border-red-300',
  performance_medium_drop: 'bg-orange-100 text-orange-800 border-orange-300',
  performance_significant_drop: 'bg-red-100 text-red-800 border-red-300',
  performance_sharp_drop: 'bg-red-200 text-red-900 border-red-400',
  no_touch_campaign: 'bg-purple-100 text-purple-800 border-purple-300',
  drop_no_action: 'bg-red-200 text-red-900 border-red-400',
  seo_stable: 'bg-blue-100 text-blue-800 border-blue-300',
  seo_down: 'bg-orange-100 text-orange-800 border-orange-300',
  no_communication_30d: 'bg-gray-100 text-gray-700 border-gray-300',
  no_communication_45d: 'bg-gray-200 text-gray-800 border-gray-400',
  seo_no_up_2months: 'bg-orange-200 text-orange-900 border-orange-400',
};

export const COMMUNICATION_STATUS_LABELS: Record<string, string> = {
  normal: 'תקין',
  sensitive: 'רגיש',
  complaint: 'תלונה',
};

export const COMMUNICATION_STATUS_COLORS: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border-green-300',
  sensitive: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  complaint: 'bg-red-100 text-red-800 border-red-300',
};

export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  client_initiated: 'הלקוח פנה',
  campaigner_initiated: 'הקמפיינר פנה',
  call: 'שיחה',
  whatsapp: 'וואטסאפ',
  meeting: 'פגישה',
  other: 'אחר',
};

export const SEO_STATUS_LABELS: Record<string, string> = {
  up: 'עלייה ↑',
  stable: 'יציב →',
  down: 'ירידה ↓',
};

export const SEO_STATUS_COLORS: Record<string, string> = {
  up: 'bg-green-100 text-green-800 border-green-300',
  stable: 'bg-blue-100 text-blue-800 border-blue-300',
  down: 'bg-red-100 text-red-800 border-red-300',
};

export const OVERALL_STATUS_CONFIG: Record<OverallStatus, { label: string; dot: string; bg: string }> = {
  green: { label: 'תקין', dot: '🟢', bg: 'bg-green-50 border-green-200' },
  yellow: { label: 'לתשומת לב', dot: '🟡', bg: 'bg-yellow-50 border-yellow-200' },
  red: { label: 'דורש טיפול', dot: '🔴', bg: 'bg-red-50 border-red-200' },
};

export const SERVICE_LABELS: Record<string, string> = {
  ppc_google: 'PPC Google',
  ppc_meta: 'PPC Meta',
  seo: 'SEO',
  social: 'Social',
  full_social: 'Full Social',
  social_meta: 'Social Meta',
  automation: 'Automation',
};

export const TIER_COLORS: Record<string, string> = {
  A: 'bg-purple-100 text-purple-800 border-purple-300',
  B: 'bg-blue-100 text-blue-800 border-blue-300',
  C: 'bg-gray-100 text-gray-700 border-gray-300',
};
