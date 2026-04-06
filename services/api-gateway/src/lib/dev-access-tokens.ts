import { createSign } from 'node:crypto';

import type { AppConfig } from '../config.js';
import type { AuthTokenClaims } from '../types.js';

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

export function mintDevAccessToken(
  config: AppConfig,
  claims: AuthTokenClaims,
  expiresInSeconds = 15 * 60,
) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const payload = {
    ...claims,
    iss: config.jwt.issuer,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(config.jwt.privateKey).toString('base64url');

  return `${signingInput}.${signature}`;
}
