import { Suspense } from 'react';

import { ConversationThreadScreen } from '@/components/conversation-thread-screen';

type ConversationThreadPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export function generateStaticParams() {
  return [{ conversationId: 'placeholder' }];
}

export const dynamicParams = false;

export default async function ConversationThreadPage({ params }: ConversationThreadPageProps) {
  const resolvedParams = await params;
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
      <ConversationThreadScreen conversationId={resolvedParams.conversationId} />
    </Suspense>
  );
}
