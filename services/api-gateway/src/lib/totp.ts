import { createHmac, randomBytes } from "node:crypto";

import {
  totpAllowedSkewWindows,
  totpDigits,
  totpStepSeconds,
} from "@weavenyc/shared";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += base32Alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = base32Alphabet.indexOf(char);
    if (index === -1) {
      throw new Error("TOTP secret is not valid base32");
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number, digits = totpDigits) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function generateTotpSecret(bytes = 20) {
  return encodeBase32(randomBytes(bytes));
}

export function buildOtpAuthUri(input: {
  issuer: string;
  accountName: string;
  secret: string;
}) {
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(totpDigits),
    period: String(totpStepSeconds),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

export function verifyTotpCode(secret: string, code: string, now = Date.now()) {
  if (!/^\d+$/.test(code)) {
    return false;
  }

  const counter = Math.floor(now / 1000 / totpStepSeconds);
  for (let offset = -totpAllowedSkewWindows; offset <= totpAllowedSkewWindows; offset += 1) {
    if (hotp(secret, counter + offset) === code) {
      return true;
    }
  }

  return false;
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () =>
    randomBytes(4)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join("-") ?? randomBytes(4).toString("hex").toUpperCase()
  );
}
