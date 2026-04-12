import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function normalizeKey(input: string) {
  return createHash("sha256").update(input).digest();
}

export function encryptSecret(value: string, keyMaterial: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeKey(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string, keyMaterial: string) {
  const [ivPart, tagPart, encryptedPart] = payload.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Encrypted secret payload is not valid");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    normalizeKey(keyMaterial),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
