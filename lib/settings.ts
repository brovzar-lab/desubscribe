import { prisma } from "./db";
import type { AutomationLevel } from "./types";

// Settings live in the DB (so they're editable in the UI) but fall back to env.
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getAutomationLevel(): Promise<AutomationLevel> {
  const v =
    (await getSetting("automationLevel")) ||
    process.env.AUTOMATION_LEVEL ||
    "full_auto";
  if (v === "draft_only" || v === "auto_marketing") return v;
  return "full_auto";
}

export async function isKillSwitchOn(): Promise<boolean> {
  return (await getSetting("killSwitch")) === "on";
}

export async function isDemoMode(): Promise<boolean> {
  // Demo mode when there's no Anthropic key AND no real connected sources.
  const hasAi = !!(process.env.ANTHROPIC_API_KEY || (await getSetting("anthropicApiKey")));
  return !hasAi;
}

export async function getAnthropicKey(): Promise<string | null> {
  return process.env.ANTHROPIC_API_KEY || (await getSetting("anthropicApiKey"));
}
