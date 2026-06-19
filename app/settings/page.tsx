import { prisma } from "@/lib/db";
import { getAutomationLevel, isKillSwitchOn, getAnthropicKey } from "@/lib/settings";
import { plaidConfigured } from "@/lib/plaid";
import { googleConfigured } from "@/lib/google";
import SettingsPanel from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [accounts, banks, level, killed, hasKey] = await Promise.all([
    prisma.emailAccount.findMany({ select: { id: true, email: true, authType: true, lastSyncedAt: true } }),
    prisma.bankItem.findMany({ select: { id: true, institution: true, lastSyncedAt: true } }),
    getAutomationLevel(),
    isKillSwitchOn(),
    getAnthropicKey(),
  ]);

  return (
    <SettingsPanel
      accounts={accounts.map((a) => ({ ...a, lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null }))}
      banks={banks.map((b) => ({ ...b, lastSyncedAt: b.lastSyncedAt?.toISOString() ?? null }))}
      automationLevel={level}
      killSwitch={killed}
      hasAnthropicKey={!!hasKey}
      plaidReady={plaidConfigured()}
      googleReady={googleConfigured()}
    />
  );
}
