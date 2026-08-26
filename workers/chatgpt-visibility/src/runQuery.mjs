import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { extractCitations, cleanAnswerText } from "./parseAnswer.mjs";

const CHATGPT_URL = process.env.CHATGPT_URL || "https://chatgpt.com/";
const STORAGE = process.env.CHATGPT_STORAGE_STATE || "./storage-state.json";
const PROXY = process.env.CHATGPT_PROXY || "";

function browserOptions() {
  const options = {
    headless: process.env.CHATGPT_HEADED !== "1",
    args: ["--disable-blink-features=AutomationControlled"],
  };
  if (PROXY) options.proxy = { server: PROXY };
  return options;
}

export async function withBrowser(fn) {
  if (!existsSync(STORAGE)) {
    throw new Error(`Missing ${STORAGE} — run npm run login on this droplet`);
  }
  const browser = await chromium.launch(browserOptions());
  try {
    const context = await browser.newContext({
      storageState: STORAGE,
      locale: "he-IL",
      timezoneId: "Asia/Jerusalem",
      viewport: { width: 1280, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    return await fn(page, context);
  } finally {
    await browser.close();
  }
}

async function firstLocator(page, selectors, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      if (await loc.count()) return loc;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function assertLoggedIn(page) {
  const url = page.url();
  if (/\/auth|\/log-in|\/login/i.test(url)) {
    throw new Error("ChatGPT session expired — re-run npm run login");
  }
  const composer = await firstLocator(page, [
    "#prompt-textarea",
    "[data-testid='prompt-textarea']",
    "div[contenteditable='true']",
  ], 8000);
  if (composer) return;
  const login = await firstLocator(page, [
    "button:has-text('Log in')",
    "button:has-text('התחברות')",
    "a:has-text('Log in')",
  ], 1500);
  if (login) throw new Error("ChatGPT session expired — re-run npm run login");
  throw new Error("ChatGPT composer not found — session expired or UI changed");
}

async function startNewChat(page) {
  const newChat = await firstLocator(page, [
    "[data-testid='create-new-chat-button']",
    "a:has-text('New chat')",
    "a:has-text('שיחה חדשה')",
    "button:has-text('New chat')",
    "a[href='/']",
  ], 4000);
  if (newChat) {
    await newChat.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
  } else {
    await page.goto(CHATGPT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
}

async function fillPrompt(page, prompt) {
  const box = await firstLocator(page, [
    "#prompt-textarea",
    "div#prompt-textarea",
    "[data-testid='prompt-textarea']",
    "div[contenteditable='true']",
    "textarea[placeholder]",
  ], 15000);
  if (!box) throw new Error("ChatGPT composer not found — session expired or UI changed");
  await box.click();
  await box.fill(prompt).catch(async () => {
    await page.keyboard.type(prompt, { delay: 12 });
  });
  const send = await firstLocator(page, [
    "[data-testid='send-button']",
    "button[data-testid='composer-submit']",
    "button[aria-label='Send prompt']",
    "button:has-text('Send')",
  ], 5000);
  if (send) {
    if (await send.isDisabled().catch(() => false)) await page.waitForTimeout(400);
    await send.click();
  } else {
    await page.keyboard.press("Enter");
  }
}

async function waitForAnswer(page) {
  const stop = page.locator("button[aria-label='Stop streaming'], button[aria-label='Stop generating']");
  try {
    await stop.first().waitFor({ state: "visible", timeout: 25000 });
    await stop.first().waitFor({ state: "hidden", timeout: 120000 });
  } catch {
    await page.waitForTimeout(8000);
  }
  await page.waitForTimeout(1500);
}

async function readLastAnswer(page) {
  const turn = page.locator("article[data-testid^='conversation-turn']").last();
  const markdown = turn.locator(".markdown, [data-message-author-role='assistant']").last();
  const node = await markdown.count() ? markdown : turn;
  const text = cleanAnswerText(await node.innerText().catch(() => ""));
  if (!text) throw new Error("Empty ChatGPT answer");
  const hrefs = await turn.locator("a[href^='http']").evaluateAll((anchors) => anchors.map((a) => a.href)).catch(() => []);
  return { text, citations: extractCitations(text, hrefs) };
}

export async function captureFailure(page, scanId, promptId) {
  try {
    await mkdir("screenshots", { recursive: true });
    await page.screenshot({ path: `screenshots/${scanId}-${promptId}.png`, fullPage: true });
  } catch {
    /* ignore */
  }
}

/** One Chromium for the whole scan. New chat per prompt. */
export async function withChatSession(fn) {
  return withBrowser(async (page) => {
    await page.goto(CHATGPT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertLoggedIn(page);
    return fn({
      page,
      ask: async (prompt) => {
        await startNewChat(page);
        await fillPrompt(page, prompt);
        await waitForAnswer(page);
        return readLastAnswer(page);
      },
    });
  });
}

export async function runChatGPTQuery(prompt) {
  return withChatSession(async ({ ask }) => ask(prompt));
}
