import { describe, expect, it } from "vitest";
import {
  ECOMMERCE_CATEGORY,
  defaultCategoryForCreate,
  isEcommerceCrmTable,
  resolveListCategory,
} from "./crmTableCategories";

describe("crmTableCategories", () => {
  it("routes facebook_ecommerce to איקומרס even when category says Facebook Insights", () => {
    expect(
      resolveListCategory({
        integration_type: "facebook_ecommerce",
        category: "Facebook Insights",
      }),
    ).toBe(ECOMMERCE_CATEGORY);
  });

  it("routes google ads ecommerce campaign_type to איקומרס", () => {
    expect(
      resolveListCategory({
        integration_type: "google_ads",
        category: "Google Ads",
        integration_settings: { campaign_type: "ecommerce" },
      }),
    ).toBe(ECOMMERCE_CATEGORY);
  });

  it("keeps facebook insights and google ads leads in their buckets", () => {
    expect(
      resolveListCategory({ integration_type: "facebook_insights", category: "Facebook Insights" }),
    ).toBe("Facebook Insights");
    expect(
      resolveListCategory({
        integration_type: "google_ads",
        category: "Google Ads",
        integration_settings: { campaign_type: "leads" },
      }),
    ).toBe("Google Ads");
  });

  it("defaultCategoryForCreate matches list buckets", () => {
    expect(defaultCategoryForCreate("facebook_ecommerce")).toBe(ECOMMERCE_CATEGORY);
    expect(defaultCategoryForCreate("google_ads", { campaignType: "ecommerce" })).toBe(ECOMMERCE_CATEGORY);
    expect(defaultCategoryForCreate("google_ads", { campaignType: "leads" })).toBe("Google Ads");
    expect(defaultCategoryForCreate("facebook_insights")).toBe("Facebook Insights");
  });

  it("isEcommerceCrmTable detects both FB and Google ecommerce", () => {
    expect(isEcommerceCrmTable({ integration_type: "facebook_ecommerce" })).toBe(true);
    expect(
      isEcommerceCrmTable({
        integration_type: "google_ads",
        integration_settings: { campaign_type: "ecommerce" },
      }),
    ).toBe(true);
    expect(isEcommerceCrmTable({ integration_type: "facebook_insights" })).toBe(false);
  });
});
