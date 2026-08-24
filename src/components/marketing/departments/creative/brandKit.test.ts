import assert from "node:assert/strict";
import test from "node:test";
import {
  brandKitPrompt,
  deriveBrandBook,
  getBrandKit,
  isGenerationAborted,
  sampleColorsFromImageData,
  throwIfGenerationAborted,
} from "./brandKit.ts";

test("getBrandKit reads logo, book, and style references from payload", () => {
  const kit = getBrandKit({
    logo_url: "https://example.com/logo.png",
    brand_book: { name: "Smartair", colors: ["#1d4ed8", "#111827"], notes: "n", source: "auto" },
    style_references: [{ url: "https://example.com/ref.jpg", name: "board" }],
  });
  assert.equal(kit.logoUrl, "https://example.com/logo.png");
  assert.equal(kit.brandBook?.name, "Smartair");
  assert.equal(kit.styleReferences.length, 1);
});

test("deriveBrandBook uses client + brief and never invents a logo rule-break", () => {
  const book = deriveBrandBook({
    clientName: "Smartair",
    website: "https://smartair.co.il",
    brief: "טיסות לרודוס במחיר הוגן",
    colors: ["#1d4ed8"],
  });
  assert.match(book.notes, /Smartair/);
  assert.match(book.notes, /לא ממציאים לוגו/);
  assert.equal(book.colors[0], "#1d4ed8");
  assert.equal(book.source, "auto");
});

test("brandKitPrompt reserves a logo pad and labels style refs", () => {
  const prompt = brandKitPrompt({
    logoUrl: "https://example.com/logo.png",
    brandBook: { colors: ["#111"], notes: "", source: "auto" },
    styleReferences: [{ url: "https://example.com/a.jpg" }],
  });
  assert.match(prompt, /top-right pad/i);
  assert.match(prompt, /style-reference/i);
  assert.match(prompt, /#111/);
});

test("getBrandKit keeps an uploaded brand-book file", () => {
  const kit = getBrandKit({
    brand_book: { colors: ["#111"], notes: "n", source: "upload", fileUrl: "https://example.com/book.pdf", fileName: "book.pdf" },
  });
  assert.equal(kit.brandBook?.fileName, "book.pdf");
  assert.equal(kit.brandBook?.source, "upload");
});

test("throwIfGenerationAborted raises a recognizable abort error", () => {
  throwIfGenerationAborted(false);
  try {
    throwIfGenerationAborted(true);
    assert.fail("expected abort");
  } catch (error) {
    assert.equal(isGenerationAborted(error), true);
  }
});

test("sampleColorsFromImageData ignores near-white and transparent pixels", () => {
  const data = new Uint8ClampedArray([
    255, 255, 255, 255,
    30, 80, 200, 255,
    30, 80, 200, 10,
    10, 10, 10, 255,
  ]);
  const colors = sampleColorsFromImageData(data);
  assert.ok(colors.some((color) => color.startsWith("#")));
  assert.ok(!colors.includes("#ffffff"));
});
