import type { ReactNode } from "react";

type StatusCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function StatusCard({
  eyebrow,
  title,
  description,
  children,
}: StatusCardProps) {
  return (
    <section
      style={{
        border: "1px solid var(--line)",
        borderRadius: 20,
        padding: 24,
        background: "var(--surface)",
        backdropFilter: "blur(18px)",
        boxShadow: "0 18px 40px rgba(73, 53, 27, 0.08)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {eyebrow}
      </p>
      <h2 style={{ margin: "12px 0 8px", fontSize: 24 }}>{title}</h2>
      <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
        {description}
      </p>
      {children ? <div style={{ marginTop: 20 }}>{children}</div> : null}
    </section>
  );
}
