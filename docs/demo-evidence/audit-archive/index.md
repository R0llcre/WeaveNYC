# Audit Archive — 32-Row Index

Four audit rounds, eight reviewers (R1–R8), four areas each round. Each entry links to its review report and the PR(s) that closed its P0/P1 findings.

Legend: `verdict` is the reviewer's close-out status (`pass` = no open P0/P1 ; `pass-with-followup` = P2 remains in M9 ; `blocked` = required another round).

| round | agent | area | verdict | report link |
|-------|-------|------|---------|-------------|
| 1 | R1 | Data migrations + DB integrity | pass-with-followup | *(R1 findings rolled into PR #59; see round4/agent-1-data-migrations.md)* |
| 1 | R2 | Auth + anchor activation | pass-with-followup | *(R2 rolled into PR #50, PR #62; see round4/agent-2-auth.md)* |
| 1 | R3 | P2P sync (server + wire) | pass | *(R3 rolled into PR #39, PR #40, PR #44)* |
| 1 | R4 | Test coverage (WS + E2E) | pass-with-followup | [round4/agent-4-tests.md](./round4/agent-4-tests.md) |
| 1 | R5 | Resource directory (Cloud Run) | pass | *(R5 rolled into PR #53)* |
| 1 | R6 | Observability (metrics + alerts) | pass-with-followup | [round4/agent-6-obs.md](./round4/agent-6-obs.md) |
| 1 | R7 | Ops + deploy workflow | pass | *(R7 rolled into PR #45, PR #46, PR #52)* |
| 1 | R8 | Chat safety + WS reliability | pass | [round4/agent-8-chat.md](./round4/agent-8-chat.md) |
| 2 | R1 | Data migrations — retention rules | pass |  |
| 2 | R2 | Auth — P0 re-auth bypass | blocked → pass | *(closed by PR #50)*  |
| 2 | R3 | P2P — protocol versioning | pass |  |
| 2 | R4 | Test coverage — two-context P2P | pass | *(closed by PR #41)*  |
| 2 | R5 | Resource directory — rate-limits | pass |  |
| 2 | R6 | Observability — Sentry init | blocked → pass | *(closed by PR #61, PR #64)*  |
| 2 | R7 | Ops — App Runner rolls | pass | *(closed by PR #46)*  |
| 2 | R8 | Chat — safety regex precision | pass | *(closed by PR #57)*  |
| 3 | R1 | Data migrations — FK + orphans | pass |  |
| 3 | R2 | Auth — block enforcement | pass | *(closed by PR #62)* |
| 3 | R3 | P2P — UX informed consent | pass | *(closed by PR #43)*  |
| 3 | R4 | Test coverage — chat-safety E2E | pass | *(closed by PR #61)*  |
| 3 | R5 | Resource directory — sidecar | pass | *(closed by PR #53)*  |
| 3 | R6 | Observability — metric cardinality | pass | *(closed by PR #64)*  |
| 3 | R7 | Ops — rollback SOP | pass | *(closed by PR #52, PR #60)* |
| 3 | R8 | Chat — WS reconnect + heartbeat | pass | *(closed by PR #58)* |
| 4 | R1 | Data migrations — final sweep | pass-with-followup | [round4/agent-1-data-migrations.md](./round4/agent-1-data-migrations.md) |
| 4 | R2 | Auth — block-fanout scrub | pass | [round4/agent-2-auth.md](./round4/agent-2-auth.md) |
| 4 | R3 | P2P — protocol_version handshake | pass |  |
| 4 | R4 | Test coverage — final | pass-with-followup | [round4/agent-4-tests.md](./round4/agent-4-tests.md) |
| 4 | R5 | Resource directory — public reach | pass | *(closed by PR #67 — CF Worker proxy)* |
| 4 | R6 | Observability — pino redact + alerts | pass | [round4/agent-6-obs.md](./round4/agent-6-obs.md) |
| 4 | R7 | Ops — CI placeholder guard | pass | *(closed by PR #65, PR #66)* |
| 4 | R8 | Chat safety + block-disconnect | pass | [round4/agent-8-chat.md](./round4/agent-8-chat.md) |

## Template

New reviewers start from [`round4/agent-0-template.md`](./round4/agent-0-template.md).

## Reports shipped in this folder

- [`round4/agent-0-template.md`](./round4/agent-0-template.md) — canonical format for all rounds
- [`round4/agent-1-data-migrations.md`](./round4/agent-1-data-migrations.md) — R1 / data migrations, final sweep
- [`round4/agent-2-auth.md`](./round4/agent-2-auth.md) — R2 / auth + block-fanout scrub
- [`round4/agent-4-tests.md`](./round4/agent-4-tests.md) — R4 / test coverage, final
- [`round4/agent-6-obs.md`](./round4/agent-6-obs.md) — R6 / observability, pino redact + alerts
- [`round4/agent-8-chat.md`](./round4/agent-8-chat.md) — R8 / chat safety + block-disconnect
