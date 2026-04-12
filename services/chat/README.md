# Chat Service

M4 status: real chat domain library.

This package owns the chat-domain rules that sit underneath the future API and
realtime transport:

- conversation list/detail metadata
- paginated message history
- send message and close conversation semantics
- block/report helpers
- safety detection hooks before delivery

It does not boot a standalone HTTP or websocket runtime by itself.
