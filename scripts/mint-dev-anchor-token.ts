import { loadConfig } from '../services/api-gateway/src/config.js';
import { mintDevAccessToken } from '../services/api-gateway/src/lib/dev-access-tokens.js';
import { seedIds } from '../packages/db/seed/fixtures.js';

async function main() {
  const config = await loadConfig();
  const token = mintDevAccessToken(config, {
    sub: seedIds.anchorUserId,
    level: 'anchor',
    role: 'anchor',
    community_ids: [seedIds.communityId],
  });

  console.log(token);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
