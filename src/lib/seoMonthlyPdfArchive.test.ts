import { describe, expect, it } from "vitest";
import { buildSeoMonthlyPdfArchivePath } from "./seoMonthlyPdfArchive";

describe("buildSeoMonthlyPdfArchivePath", () => {
  it("uses a stable client/month path so regenerating replaces the same report", () => {
    expect(
      buildSeoMonthlyPdfArchivePath({
        tenantId: "tenant-1",
        clientId: "client-2",
        month: "2026-08-01",
      }),
    ).toBe("tenant-1/client/client-2/seo-reports/seo-monthly-2026-08.pdf");
  });

  it("sanitizes malformed month values", () => {
    expect(
      buildSeoMonthlyPdfArchivePath({
        tenantId: "tenant-1",
        clientId: "client-2",
        month: "../bad",
      }),
    ).toBe("tenant-1/client/client-2/seo-reports/seo-monthly-unknown.pdf");
  });
});
