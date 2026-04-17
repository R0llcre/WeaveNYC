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
        <main className="shell" id="main-content" tabIndex={-1}>
          <div className="shell__inner">
            <section className="card">
              <p>Loading…</p>
            </section>
          </div>
        </main>
      }
    >
      <ResourceDetailScreen providerId={resolved.providerId} />
    </Suspense>
  );
}
