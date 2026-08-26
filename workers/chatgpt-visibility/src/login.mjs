import { chromium } from "playwright";

const STORAGE = process.env.CHATGPT_STORAGE_STATE || "./storage-state.json";
const PROXY = process.env.CHATGPT_PROXY || "";

const browser = await chromium.launch({
  headless: false,
  args: ["--disable-blink-features=AutomationControlled"],
  ...(PROXY ? { proxy: { server: PROXY } } : {}),
});
const context = await browser.newContext({
  locale: "he-IL",
  timezoneId: "Asia/Jerusalem",
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
await page.goto("https://chatgpt.com/");
console.log("Log in to ChatGPT in the opened window. Storage is saved when you press Enter here.");
await new Promise((resolve) => process.stdin.once("data", resolve));
await context.storageState({ path: STORAGE });
console.log(`Saved session to ${STORAGE}`);
await browser.close();
