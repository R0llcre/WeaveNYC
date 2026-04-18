import { Suspense } from "react";

import { ResourceDetailScreen } from "@/components/resource-detail-screen";

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
    <Suspense
      fallback={
        <div className="page-content">
          <section className="card">
            <p>Loading…</p>
          </section>
        </div>
      }
    >
      <ResourceDetailScreen providerId={resolved.providerId} />
    </Suspense>
  );
}
