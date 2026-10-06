export function buildSeoMonthlyPdfArchivePath(input: {
  tenantId: string;
  clientId: string;
  month: string;
}): string {
  const month = input.month.slice(0, 7).replace(/[^0-9-]/g, "") || "unknown";
  return `${input.tenantId}/client/${input.clientId}/seo-reports/seo-monthly-${month}.pdf`;
}
