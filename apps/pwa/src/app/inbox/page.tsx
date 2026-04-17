import { Suspense } from 'react';

import { ChatInboxScreen } from '@/components/chat-inbox-screen';

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <main className="shell" id="main-content" tabIndex={-1}>
          <div className="shell__inner">
            <section className="card">
              <p>Loading…</p>
            </section>
          </div>
        </main>
      }
    >
      <ChatInboxScreen initialView="all" />
    </Suspense>
  );
}
