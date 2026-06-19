import { google } from "googleapis";
import { clientFromCipher } from "./google";

export interface RenewalItem {
  id: string;
  name: string;
  amount: number | null;
  currency: string;
  nextDueAt: Date;
  isTrial: boolean;
}

// Build an RFC 5545 .ics calendar with an all-day event per upcoming renewal,
// each with a 2-day-before alarm.
export function buildIcs(items: RenewalItem[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//desubscribe//renewals//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const it of items) {
    const date = ymd(it.nextDueAt);
    const amount = it.amount != null ? ` ${it.currency} ${it.amount.toFixed(2)}` : "";
    const title = it.isTrial ? `⚠️ ${it.name} trial converts` : `${it.name} renews${amount}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:desub-${it.id}@desubscribe`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(`Heads up from Desubscribe — cancel before this date to avoid the charge.`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P2D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// Push the same renewals into the user's Google Calendar (needs an OAuth account).
export async function pushToGoogleCalendar(
  oauthCipher: string,
  items: RenewalItem[],
): Promise<{ created: number }> {
  const auth = clientFromCipher(oauthCipher);
  const cal = google.calendar({ version: "v3", auth });
  let created = 0;
  for (const it of items) {
    const date = it.nextDueAt.toISOString().slice(0, 10);
    const amount = it.amount != null ? ` (${it.currency} ${it.amount.toFixed(2)})` : "";
    await cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: it.isTrial ? `⚠️ ${it.name} trial converts${amount}` : `${it.name} renews${amount}`,
        description: "Desubscribe reminder — cancel before this date to avoid the charge.",
        start: { date },
        end: { date },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 2 * 24 * 60 }] },
      },
    });
    created++;
  }
  return { created };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
function stamp(d: Date): string {
  return `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}Z`;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function escapeIcs(s: string): string {
  return s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}
