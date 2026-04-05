import Link from "next/link";

import { ApiHealthPanel } from "@/components/api-health-panel";
import { StatusCard } from "@/components/status-card";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 24px 80px",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <header
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            WeaveNYC / Anchor Admin / M0
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2.6rem, 5vw, 4.5rem)",
              lineHeight: 0.96,
              maxWidth: 700,
            }}
          >
            Minimal admin shell with live gateway health checks.
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: "var(--muted)", lineHeight: 1.7 }}>
            This slice only proves the admin surface exists, can reach the API
            gateway, and exposes a stable placeholder route for anchor login.
            Moderation, announcements, and review queue tooling start in later
            milestones.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
          }}
        >
          <StatusCard
            eyebrow="Gateway health"
            title="Backend heartbeat"
            description="The panel below checks the two M0 readiness endpoints that the admin shell depends on."
          >
            <ApiHealthPanel />
          </StatusCard>

          <StatusCard
            eyebrow="Anchor access"
            title="Placeholder login"
            description="M0 reserves the route and interaction copy, but does not implement anchor authentication yet."
          >
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 18px",
                borderRadius: 999,
                background: "var(--accent-strong)",
                color: "white",
                fontWeight: 600,
              }}
            >
              Open login placeholder
            </Link>
          </StatusCard>
        </section>
      </div>
    </main>
  );
}
