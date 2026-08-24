import { describe, expect, it } from "vitest";
import {
  UNKNOWN_UPDATE_AUTHOR,
  resolveUpdateAuthorName,
} from "./updateAuthor";

describe("resolveUpdateAuthorName", () => {
  it("prefers the profile name when it is set", () => {
    expect(
      resolveUpdateAuthorName({
        full_name: "Anna Relin",
        email: "anna@example.com",
        campaigners: { full_name: "אנה" },
      }),
    ).toBe("Anna Relin");
  });

  it("falls back to the campaigner name when the profile name is empty", () => {
    expect(
      resolveUpdateAuthorName({
        full_name: "",
        email: "david@example.com",
        campaigners: { full_name: "דוד" },
      }),
    ).toBe("דוד");
  });

  it("treats a whitespace-only profile name as empty", () => {
    expect(
      resolveUpdateAuthorName({
        full_name: "   ",
        email: "david@example.com",
        campaigners: { full_name: "דוד" },
      }),
    ).toBe("דוד");
  });

  it("accepts the embed coming back as an array", () => {
    expect(
      resolveUpdateAuthorName({
        full_name: null,
        email: "david@example.com",
        campaigners: [{ full_name: "דוד" }],
      }),
    ).toBe("דוד");
  });

  it("falls back to the email when no name is reachable", () => {
    expect(
      resolveUpdateAuthorName({ full_name: null, email: "david@example.com", campaigners: null }),
    ).toBe("david@example.com");
  });

  it("falls back to a generic label when the profile is unreadable", () => {
    expect(resolveUpdateAuthorName(null)).toBe(UNKNOWN_UPDATE_AUTHOR);
    expect(resolveUpdateAuthorName({ full_name: "", email: "", campaigners: [] })).toBe(
      UNKNOWN_UPDATE_AUTHOR,
    );
  });
});
