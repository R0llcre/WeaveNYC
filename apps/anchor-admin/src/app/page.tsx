"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiHealthPanel } from "@/components/api-health-panel";
import { AdminShell } from "@/components/admin-shell";
import {
  type AdminDashboardResponse,
  type ApiErrorPayload,
  isRecord,
  readString,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type DashboardCard = {
  key: keyof AdminDashboardResponse;
  label: string;
  note: string;
  tone?: "accent";
};

const dashboardCards: DashboardCard[] = [
  {
    key: "posts_this_week_request_count",
    label: "Request posts this week",
    note: "Requests entering the moderation and matching pipeline.",
  },
  {
    key: "posts_this_week_offer_count",
    label: "Offer posts this week",
    note: "Offers that can feed matches, inbox, and review checks.",
  },
  {
    key: "accepted_contacts_this_week_count",
    label: "Accepted contacts",
    note: "Contact requests that moved into a conversation placeholder.",
    tone: "accent",
  },
  {
    key: "reports_this_week_count",
    label: "Reports this week",
    note: "Community safety reports queued for admin attention.",
  },
  {
    key: "pending_post_review_count",
    label: "Pending post reviews",
    note: "Posts waiting for approve, reject, or more-info decisions.",
  },
  {
    key: "pending_report_count",
    label: "Pending report reviews",
    note: "Reports that still need moderation actions.",
  },
];

function readErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    const message = readString(error, "message", "detail", "error");
    if (message) {
      return message;
    }

    const payload = error as ApiErrorPayload & Record<string, unknown>;
    if (typeof payload.status === "number") {
      return `Request failed with ${payload.status}`;
    }
  }

  return "Request failed";
}

export default function HomePage() {
  const { isAnchor, isAuthenticated, requestJson, selectedCommunityId } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!isAnchor || !selectedCommunityId) {
        setDashboard(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await requestJson<AdminDashboardResponse>(
          `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/dashboard`,
        );
        if (!cancelled) {
          setDashboard(data);
          setUpdatedAt(new Date().toLocaleString());
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(readErrorMessage(fetchError));
          setDashboard(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [isAnchor, requestJson, selectedCommunityId]);

  const values = useMemo(
    () =>
      dashboardCards.map((card) => ({
        ...card,
        value:
          dashboard && typeof dashboard[card.key] === "number"
            ? String(dashboard[card.key])
            : loading
              ? "Loading"
              : "—",
      })),
    [dashboard, loading],
  );

  return (
    <AdminShell
      eyebrow="M5 Anchor Admin"
      title="Dashboard"
      subtitle="Operational overview for moderation, announcements, rules, and the current community workflow."
      actions={
        <>
          <Link className="button secondary" href="/review">
            Open review queue
          </Link>
          <Link className="button primary" href="/announcements">
            Manage announcements
          </Link>
        </>
      }
    >
      <section className="hero">
        <div className="hero-actions">
          <Link className="button primary" href="/activate">
            Activate anchor
          </Link>
          <Link className="button secondary" href="/login">
            Start anchor session
          </Link>
          <Link className="button ghost" href="/rules">
            Open rules
          </Link>
        </div>
        <div className="hero-callout">
          <strong>Current scope</strong>
          <div className="muted">
            {isAuthenticated
              ? selectedCommunityId
                ? `Loaded community ${selectedCommunityId}.`
                : "Authenticated session loaded. Set a community id to pull dashboard data."
              : "No session loaded yet. Use the login or activate flow to populate the admin shell."}
          </div>
        </div>
      </section>

      {!isAnchor ? (
        <section className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Anchor session required</h2>
              <p className="panel-subtitle">
                The dashboard shell is live, but admin actions and queue data
                require an anchor session. Restore a verified session, activate
                anchor access, and then return here.
              </p>
            </div>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href="/login">
              Go to login
            </Link>
            <Link className="button secondary" href="/activate">
              Go to activation
            </Link>
          </div>
        </section>
      ) : null}

      <section className="panel pad">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Weekly dashboard</h2>
            <p className="panel-subtitle">
              {loading
                ? "Loading live metrics from the gateway."
                : error
                  ? `Dashboard fetch failed: ${error}`
                  : updatedAt
                    ? `Last updated ${updatedAt}`
                    : "Waiting for data."}
            </p>
          </div>
          <div className="badge info">
            {selectedCommunityId ? selectedCommunityId : "No community selected"}
          </div>
        </div>

        <div className="grid-6">
          {values.map((card) => (
            <article key={card.key} className="metric-card" data-tone={card.tone}>
              <div className="metric-label">{card.label}</div>
              <div className="metric-value">{card.value}</div>
              <p className="metric-note">{card.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split">
        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Gateway health</h2>
              <p className="panel-subtitle">
                Light-weight readiness checks against the local gateway.
              </p>
            </div>
          </div>
          <ApiHealthPanel />
        </div>

        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Navigation</h2>
              <p className="panel-subtitle">
                The shell keeps the admin workflow organized around moderation,
                communication, and operational setup.
              </p>
            </div>
          </div>
          <div className="list">
            <Link className="item" href="/review">
              <div className="item-head">
                <h3 className="item-title">Review queue</h3>
                <span className="badge warning">Posts / Reports</span>
              </div>
              <p className="item-body">
                Handle moderation decisions with separate queues for posts and
                reports.
              </p>
            </Link>
            <Link className="item" href="/announcements">
              <div className="item-head">
                <h3 className="item-title">Announcements</h3>
                <span className="badge info">CRUD</span>
              </div>
              <p className="item-body">
                Create, edit, pin, and delete community announcements.
              </p>
            </Link>
            <Link className="item" href="/rules">
              <div className="item-head">
                <h3 className="item-title">Rules</h3>
                <span className="badge success">Policy</span>
              </div>
              <p className="item-body">
                Tune moderation categories, blocklists, and announcement policy.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
