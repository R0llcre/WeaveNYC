import { Suspense } from "react";

import { ResourceDetailScreen } from "@/components/resource-detail-screen";
import { RouteLoadingFallback } from "@/components/ui";

type ResourceDetailPageProps = {
  params: Promise<{
    providerId: string;
  }>;
};

export function generateStaticParams() {
  return [{ providerId: "placeholder" }];
}

export const dynamicParams = false;

export default async function ResourceDetailPage({ params }: ResourceDetailPageProps) {
  const resolved = await params;
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <ResourceDetailScreen providerId={resolved.providerId} />
    </Suspense>
  );
}
