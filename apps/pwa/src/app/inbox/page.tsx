import { Suspense } from 'react';

import { ChatInboxScreen } from '@/components/chat-inbox-screen';
import { RouteLoadingFallback } from '@/components/ui';

export default function InboxPage() {
  return (
    // AppShell (mounted by ShellFrame in the root layout) owns the
    // <main id="main-content"> landmark; the Suspense fallback only
    // provides the inner page-content so we never duplicate the main
    // element while the client entry point is hydrating.
    <Suspense fallback={<RouteLoadingFallback />}>
      <ChatInboxScreen initialView="all" />
    </Suspense>
  );
}
