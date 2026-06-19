import { prisma } from "../db";
import { merchantKey } from "../dedupe";

// A single replayable step. Generate these with `npx playwright codegen <url>`
// and translate the actions, or hand-write them.
export interface MacroStep {
  action: "goto" | "click" | "fill" | "waitFor" | "press";
  selector?: string;
  value?: string;
  url?: string;
}

export function validateSteps(input: unknown): MacroStep[] | null {
  if (!Array.isArray(input)) return null;
  const ok = input.every(
    (s) => s && typeof s === "object" && typeof (s as MacroStep).action === "string",
  );
  return ok ? (input as MacroStep[]) : null;
}

// Find a saved macro for a service name (matched by normalized merchant key).
export async function getMacroSteps(serviceName: string): Promise<MacroStep[] | null> {
  const key = merchantKey(serviceName);
  if (!key) return null;
  const macro = await prisma.cancelMacro.findUnique({ where: { merchantKey: key } });
  if (!macro) return null;
  return validateSteps(JSON.parse(macro.steps));
}

// Replay steps against an already-open Playwright page. Returns a step-by-step log.
export async function runMacro(page: unknown, steps: MacroStep[]): Promise<string[]> {
  // `page` is a playwright Page; typed as unknown so this module needs no playwright types.
  const p = page as {
    goto: (u: string, o?: unknown) => Promise<unknown>;
    click: (s: string, o?: unknown) => Promise<unknown>;
    fill: (s: string, v: string, o?: unknown) => Promise<unknown>;
    waitForSelector: (s: string, o?: unknown) => Promise<unknown>;
    keyboard: { press: (k: string) => Promise<unknown> };
  };
  const log: string[] = [];
  for (const step of steps) {
    try {
      if (step.action === "goto" && step.url) { await p.goto(step.url, { waitUntil: "domcontentloaded", timeout: 30000 }); log.push(`goto ${step.url}`); }
      else if (step.action === "click" && step.selector) { await p.click(step.selector, { timeout: 8000 }); log.push(`click ${step.selector}`); }
      else if (step.action === "fill" && step.selector) { await p.fill(step.selector, step.value ?? "", { timeout: 8000 }); log.push(`fill ${step.selector}`); }
      else if (step.action === "waitFor" && step.selector) { await p.waitForSelector(step.selector, { timeout: 10000 }); log.push(`waitFor ${step.selector}`); }
      else if (step.action === "press" && step.value) { await p.keyboard.press(step.value); log.push(`press ${step.value}`); }
      else log.push(`skipped malformed step ${JSON.stringify(step)}`);
    } catch (e) {
      log.push(`FAILED ${step.action} ${step.selector ?? step.url ?? ""}: ${String(e).slice(0, 120)}`);
      break; // stop on first failure so we don't blunder through a flow
    }
  }
  return log;
}
