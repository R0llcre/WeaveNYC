import { ResourceDetailScreen } from "@/components/resource-detail-screen";

type ResourceDetailPageProps = {
  params: Promise<{
    providerId: string;
  }>;
};

export default async function ResourceDetailPage({ params }: ResourceDetailPageProps) {
  const resolved = await params;
  return <ResourceDetailScreen providerId={resolved.providerId} />;
}
