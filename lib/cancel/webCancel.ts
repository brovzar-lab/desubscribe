import path from "node:path";
import fs from "node:fs/promises";

// Drive a cancel page with Playwright. Playwright is an OPTIONAL dependency and
// a heavy browser download, so we import it dynamically and degrade gracefully.
// Cancel flows differ per merchant and change often; this is best-effort and
// every step is screenshotted for the audit log.
export async function webCancel(
  cancelUrl: string,
  serviceName: string,
): Promise<{ ok: boolean; detail: string; screenshotPath: string | null }> {
  // Playwright is an optional, heavy peer dep that may not be installed.
  // Keep it untyped + opaque to the bundler so builds work without it.
  let chromium: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const mod = "playwright";
    ({ chromium } = await import(/* webpackIgnore: true */ mod));
  } catch {
    return {
      ok: false,
      detail:
        "Playwright not installed. Run `npm i playwright && npx playwright install chromium` to enable web cancels.",
      screenshotPath: null,
    };
  }

  const dir = path.join(process.cwd(), "screenshots");
  await fs.mkdir(dir, { recursive: true });
  const shot = path.join(dir, `${slug(serviceName)}-${Date.now()}.png`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(cancelUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Best-effort: click an obvious cancel control if present.
    const candidates = [
      "text=/cancel (membership|subscription|plan)/i",
      "text=/cancel/i",
      "role=button[name=/cancel/i]",
    ];
    let clicked = false;
    for (const sel of candidates) {
      const el = page.locator(sel).first();
      if (await el.count().catch(() => 0)) {
        await el.click({ timeout: 5000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    return {
      ok: clicked,
      detail: clicked
        ? `Opened ${cancelUrl} and clicked a cancel control. Verify completion in the screenshot — many flows require login/confirmation a bot can't safely complete.`
        : `Opened ${cancelUrl} but found no obvious cancel button. Manual step likely needed.`,
      screenshotPath: shot,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
