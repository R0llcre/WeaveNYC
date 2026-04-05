"use client";

import { useEffect, useState } from "react";

import { DEFAULT_API_BASE_URL, fetchHealth, type HealthStatus } from "@/lib/api";

const endpoints = ["/healthz", "/readyz"];

export function ApiHealthPanel() {
  const [items, setItems] = useState<HealthStatus[]>(() =>
    endpoints.map((endpoint) => ({
      ok: false,
      endpoint,
      status: null,
      detail: "pending",
    })),
  );
  const [updatedAt, setUpdatedAt] = useState<string>("never");
  const [loading, setLoading] = useState<boolean>(true);

  async function refresh() {
    setLoading(true);
    const results = await Promise.all(endpoints.map((endpoint) => fetchHealth(endpoint)));
    setItems(results);
    setUpdatedAt(new Date().toLocaleTimeString());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            API base
          </p>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{DEFAULT_API_BASE_URL}</p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          style={{
            border: 0,
            borderRadius: 999,
            padding: "12px 18px",
            background: loading ? "#98c2b6" : "var(--accent)",
            color: "white",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Checking..." : "Refresh health"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => (
          <div
            key={item.endpoint}
            style={{
              display: "grid",
              gap: 8,
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 16,
              background: "var(--surface-strong)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <strong>{item.endpoint}</strong>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  background: item.ok ? "rgba(15, 107, 86, 0.12)" : "rgba(154, 66, 0, 0.12)",
                  color: item.ok ? "var(--success)" : "var(--warning)",
                }}
              >
                {item.ok ? "healthy" : "unreachable"}
              </span>
            </div>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {item.status ? `HTTP ${item.status}` : "No HTTP response"} · {item.detail}
            </p>
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
        Last checked: {updatedAt}
      </p>
    </div>
  );
}
