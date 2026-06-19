import { google } from "googleapis";
import { encrypt, decrypt } from "./crypto";

// Google OAuth for Gmail (read + send) and Calendar (renewal reminders).

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.APP_URL || "http://localhost:3000"}/api/google/callback`
  );
}

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri(),
  );
}

export function authUrl(): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token
    scope: GOOGLE_SCOPES,
  });
}

export interface StoredTokens {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
}

export async function exchangeCode(code: string): Promise<{ email: string; tokens: StoredTokens }> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  return { email: me.data.email || "unknown", tokens };
}

// Build an authed client from an account's encrypted tokens, refreshing as needed.
export function clientFromCipher(oauthCipher: string) {
  const tokens = JSON.parse(decrypt(oauthCipher)) as StoredTokens;
  const client = oauthClient();
  client.setCredentials(tokens);
  return client;
}

export function encryptTokens(tokens: StoredTokens): string {
  return encrypt(JSON.stringify(tokens));
}
