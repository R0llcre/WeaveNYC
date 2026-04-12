# Match Service

M3 status: domain library.

This package owns:

- Top-3 action plan computation for active request posts
- one-refresh batch rotation with official-resource fallback
- `contact_requests` domain rules
- accept/reject state transitions
- accepted-conversation linkage used by the M3 inbox flow
- an in-memory implementation for domain tests

It does not ship a standalone HTTP runtime. The API surface stays in
`services/api-gateway`.
