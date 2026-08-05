import { describe, expect, it } from "vitest";
import {
  countFilledConnections,
  pickGaPropertyForDomain,
  pickGscSiteForDomain,
  shouldCreateDashboardForConnections,
} from "./clientConnectionProvision";

describe("clientConnectionProvision", () => {
  it("counts a single Meta connection as 1 → no dashboard", () => {
    const fields = { meta_ads_account_id: "act_123" };
    expect(countFilledConnections(fields, ["ppc_meta"])).toBe(1);
    expect(shouldCreateDashboardForConnections(fields, ["ppc_meta"])).toBe(false);
  });

  it("counts Meta + Google Ads as 2 → dashboard", () => {
    const fields = {
      meta_ads_account_id: "act_123",
      google_ads_account_id: "123-456-7890",
    };
    expect(countFilledConnections(fields, ["ppc_meta", "ppc_google"])).toBe(2);
    expect(shouldCreateDashboardForConnections(fields, ["ppc_meta", "ppc_google"])).toBe(true);
  });

  it("counts SEO website bundle as one connection", () => {
    const fields = { website: "https://www.example.com" };
    expect(countFilledConnections(fields, ["seo"])).toBe(1);
    expect(shouldCreateDashboardForConnections(fields, ["seo"])).toBe(false);
  });

  it("picks sc-domain GSC site over URL property", () => {
    const site = pickGscSiteForDomain(
      [
        { siteUrl: "https://www.example.com/" },
        { siteUrl: "sc-domain:example.com" },
      ],
      "https://example.com",
    );
    expect(site).toBe("sc-domain:example.com");
  });

  it("picks GA property whose name matches the domain", () => {
    const id = pickGaPropertyForDomain(
      [
        { id: "properties/1", name: "Other Site" },
        { id: "properties/2", name: "example.com" },
      ],
      "https://www.example.com",
    );
    expect(id).toBe("properties/2");
  });
});
