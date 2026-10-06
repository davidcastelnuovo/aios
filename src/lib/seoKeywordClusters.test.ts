import { describe, expect, it } from "vitest";
import { clusterKeywords, clusterTokens } from "./seoKeywordClusters";

describe("clusterKeywords", () => {
  it("groups Eco-style destination and trek phrases", () => {
    const keywords = [
      { keyword: "טיולים לארגנטינה", position: 4 },
      { keyword: "טיול מאורגן לארגנטינה", position: 8 },
      { keyword: "טרקים בארגנטינה", position: 12 },
      { keyword: "טיול לצ'ילה", position: 6 },
      { keyword: "טיול מאורגן לצ'ילה", position: 9 },
      { keyword: "טרקים בצ'ילה", position: 11 },
      { keyword: "טרק בפארק טורס דל פיינה", position: 15 },
    ];

    const clusters = clusterKeywords(keywords);
    const names = clusters.map((c) => c.key);

    expect(names).toContain("ארגנטינה");
    expect(names).toContain("צילה");
    expect(names).toContain("טרק");
    expect(names).toContain("טיול מאורגן");

    const argentina = clusters.find((c) => c.key === "ארגנטינה")!;
    expect(argentina.keywords.map((k) => k.keyword)).toEqual([
      "טיולים לארגנטינה",
      "טיול מאורגן לארגנטינה",
      "טרקים בארגנטינה",
    ]);
    expect(argentina.avgPosition).toBe(8);
    expect(argentina.shortTail).toBe(2);
    expect(argentina.longTail).toBe(1);
  });

  it("does not create a catch-all cluster from a generic word like טיול", () => {
    const clusters = clusterKeywords([
      { keyword: "טיולים לארגנטינה", position: 4 },
      { keyword: "טיול לארגנטינה זול", position: 5 },
      { keyword: "טיול לצ'ילה", position: 6 },
      { keyword: "טיולים לצ'ילה", position: 7 },
    ]);
    expect(clusters.some((c) => c.key === "טיול")).toBe(false);
    expect(clusters.map((c) => c.key)).toEqual(expect.arrayContaining(["ארגנטינה", "צילה"]));
  });
});

describe("clusterTokens", () => {
  it("stems prefixed Hebrew destination names", () => {
    expect(clusterTokens("טיולים לארגנטינה")).toEqual(expect.arrayContaining(["ארגנטינה"]));
    expect(clusterTokens("טרקים בצ'ילה")).toEqual(expect.arrayContaining(["צילה", "טרק"]));
  });
});
