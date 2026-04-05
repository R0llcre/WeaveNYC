import Link from "next/link";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          border: "1px solid var(--line)",
          borderRadius: 24,
          padding: 32,
          background: "var(--surface)",
          boxShadow: "0 18px 40px rgba(73, 53, 27, 0.08)",
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
          Placeholder route
        </p>
        <h1 style={{ margin: "12px 0", fontSize: 36 }}>Anchor login arrives after M0.</h1>
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.7 }}>
          This page intentionally stops at structure and copy. Real anchor
          authentication depends on the API gateway auth workflow and RBAC work
          scheduled for later phases.
        </p>

        <div
          style={{
            marginTop: 24,
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 16,
              background: "var(--surface-strong)",
            }}
          >
            <strong>Reserved inputs</strong>
            <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
              Email or phone, verification challenge, anchor role confirmation.
            </p>
          </div>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              justifyContent: "center",
              padding: "12px 18px",
              borderRadius: 999,
              border: "1px solid var(--line)",
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
