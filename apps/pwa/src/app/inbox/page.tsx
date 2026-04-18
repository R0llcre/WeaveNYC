import { Suspense } from 'react';

import { ChatInboxScreen } from '@/components/chat-inbox-screen';

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        // AppShell (mounted by ShellFrame in the root layout) owns the
        // <main id="main-content"> landmark; the Suspense fallback only
        // provides the inner page-content so we never duplicate the main
        // element while the client entry point is hydrating.
        <div className="page-content">
          <section className="card" aria-label="Loading">
            <p>Loading…</p>
          </section>
        </div>
      }
    >
      <ChatInboxScreen initialView="all" />
    </Suspense>
  );
}
