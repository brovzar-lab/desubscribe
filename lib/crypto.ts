import crypto from "node:crypto";

// AES-256-GCM encryption for credentials stored in SQLite.
// Keyed by ENCRYPTION_KEY (hex or any string; hashed to 32 bytes).

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw) {
    // Demo fallback so the app runs without config. NOT secure — set ENCRYPTION_KEY in prod.
    return crypto.createHash("sha256").update("desubscribe-demo-insecure-key").digest();
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  });
}

export function decrypt(blob: string): string {
  const { iv, tag, data } = JSON.parse(blob);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
