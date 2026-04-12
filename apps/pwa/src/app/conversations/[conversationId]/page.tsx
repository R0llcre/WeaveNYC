import { ConversationThreadScreen } from '@/components/conversation-thread-screen';

type ConversationThreadPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export default async function ConversationThreadPage({ params }: ConversationThreadPageProps) {
  const resolvedParams = await params;
  return <ConversationThreadScreen conversationId={resolvedParams.conversationId} />;
}
