import { webcrypto } from "node:crypto";

import type { P2PEventEnvelope } from "@weavenyc/shared";

import { canonicalizeBytes } from "./canonical.js";

const subtle = globalThis.crypto?.subtle ?? webcrypto.subtle;
const encoder = new TextEncoder();

function toArrayBuffer(bytes: Uint8Array) {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }

  return bytes.slice().buffer;
}

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return new Uint8Array(Buffer.from(`${normalized}${padding}`, "base64"));
}

async function importSigningKey(secret: string | Uint8Array) {
  const keyBytes = typeof secret === "string" ? encoder.encode(secret) : secret;

  return subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"],
  );
}

type UnsignedEnvelope = Omit<P2PEventEnvelope, "signature">;

function toUnsignedEnvelope(envelope: UnsignedEnvelope | P2PEventEnvelope): UnsignedEnvelope {
  const unsignedEnvelope = { ...(envelope as P2PEventEnvelope) };
  delete (unsignedEnvelope as Partial<P2PEventEnvelope>).signature;
  return unsignedEnvelope;
}

export async function signEventEnvelope(
  envelope: UnsignedEnvelope | P2PEventEnvelope,
  secret: string | Uint8Array,
) {
  const key = await importSigningKey(secret);
  const bytes = canonicalizeBytes(toUnsignedEnvelope(envelope));
  const signature = await subtle.sign("HMAC", key, toArrayBuffer(bytes));
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyEventEnvelopeSignature(
  envelope: P2PEventEnvelope,
  secret: string | Uint8Array,
) {
  if (!envelope.signature) {
    return false;
  }

  const key = await importSigningKey(secret);
  const signatureBytes = fromBase64Url(envelope.signature);
  const bytes = canonicalizeBytes(toUnsignedEnvelope(envelope));
  return subtle.verify("HMAC", key, toArrayBuffer(signatureBytes), toArrayBuffer(bytes));
}

export async function attachEventEnvelopeSignature(
  envelope: UnsignedEnvelope | P2PEventEnvelope,
  secret: string | Uint8Array,
): Promise<P2PEventEnvelope> {
  const signature = await signEventEnvelope(envelope, secret);
  return {
    ...toUnsignedEnvelope(envelope),
    signature,
  } as P2PEventEnvelope;
}
