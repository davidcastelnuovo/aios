import { CampaignPulseDashboard } from "@/pages/DMMDashboard";

interface AgencyDashboardContentProps {
  agencyId: string;
  agencyName: string;
  dateFilter: string;
  customFrom?: string;
  customTo?: string;
}

/**
 * Agency dashboard entry point — same unified pulse + campaign view as /dmm-dashboard.
 */
export function AgencyDashboardContent({ agencyId }: AgencyDashboardContentProps) {
  return <CampaignPulseDashboard fixedAgencyId={agencyId} showTitle={false} />;
}
