import { Suspense } from 'react';

import { ConversationThreadScreen } from '@/components/conversation-thread-screen';
import { RouteLoadingFallback } from '@/components/ui';

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
    // AppShell (via ShellFrame) provides the <main id="main-content">
    // landmark; the Suspense fallback just fills the inner page-content
    // slot while the thread client component hydrates.
    <Suspense fallback={<RouteLoadingFallback />}>
      <ConversationThreadScreen conversationId={resolvedParams.conversationId} />
    </Suspense>
  );
}
