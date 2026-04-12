"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  type ReviewDecisionResponse,
  type ReviewQueueItem,
  type ReviewQueueResponse,
  isRecord,
  readString,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type ReviewTab = "posts" | "reports";

function readErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    return readString(error, "message", "detail", "error") ?? "Request failed";
  }

  return "Request failed";
}

function normalizeQueueItems(payload: unknown): ReviewQueueItem[] {
  if (Array.isArray(payload)) {
    return payload as ReviewQueueItem[];
  }

  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items as ReviewQueueItem[];
  }

  return [];
}

function queueLabel(item: ReviewQueueItem, tab: ReviewTab) {
  if (tab === "posts") {
    return item.risk_level ?? item.priority ?? "review";
  }

  return item.priority ?? item.status ?? "review";
}

function itemTitle(item: ReviewQueueItem, tab: ReviewTab) {
  if (tab === "posts") {
    return item.title ?? item.category ?? item.post_id ?? "Untitled post";
  }

  const targetSummary =
    typeof item.target_summary === "string"
      ? item.target_summary
      : item.target_summary?.title;
  return targetSummary ?? item.reporter_alias ?? item.report_id ?? "Untitled report";
}

function itemSubtitle(item: ReviewQueueItem, tab: ReviewTab) {
  if (tab === "posts") {
    return item.body ?? item.notes ?? "No post body available.";
  }

  const preview =
    typeof item.target_summary === "object" && item.target_summary
      ? item.target_summary.body_preview
      : null;
  return item.notes ?? preview ?? item.target_type ?? "No report detail available.";
}

export default function ReviewPage() {
  const { isAnchor, requestJson, selectedCommunityId } = useAuth();
  const [tab, setTab] = useState<ReviewTab>("posts");
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQueue() {
      if (!isAnchor || !selectedCommunityId) {
        setItems([]);
        setCursor(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const endpoint =
          tab === "posts"
            ? `/v1/admin/review_queue?community_id=${encodeURIComponent(selectedCommunityId)}`
            : `/v1/admin/report_queue?community_id=${encodeURIComponent(selectedCommunityId)}`;
        const payload = await requestJson<ReviewQueueResponse>(endpoint);
        if (!cancelled) {
          setItems(normalizeQueueItems(payload));
          setCursor(payload.cursor ?? payload.next_cursor ?? null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(readErrorMessage(fetchError));
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, [isAnchor, refreshNonce, requestJson, selectedCommunityId, tab]);

  const emptyText = useMemo(() => {
    if (!isAnchor) {
      return "Anchor session required before moderation queues are available.";
    }

    if (!selectedCommunityId) {
      return "Set a community id in the header to load the queue.";
    }

    return tab === "posts"
      ? "No posts are currently waiting in the review queue."
      : "No reports are currently waiting in the review queue.";
  }, [isAnchor, selectedCommunityId, tab]);

  const handleDecision = async (item: ReviewQueueItem, decision: string) => {
    const postId = item.post_id ?? item.report_id;
    if (!postId) {
      return;
    }

    setBusyKey(`${tab}:${postId}:${decision}`);
    setError(null);
    try {
      await requestJson<ReviewDecisionResponse>(
        tab === "posts"
          ? `/v1/admin/review_queue/${encodeURIComponent(postId)}/decision`
          : `/v1/admin/report_queue/${encodeURIComponent(postId)}/decision`,
        {
          method: "POST",
          body: { decision },
        },
      );
      setRefreshNonce((value) => value + 1);
    } catch (decisionError) {
      setError(readErrorMessage(decisionError));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <AdminShell
      eyebrow="M5 Moderation"
      title="Review queue"
      subtitle="Separate posts and reports into their own tabs so moderation can stay focused."
      actions={
        <>
          <button className="button secondary" onClick={() => setRefreshNonce((v) => v + 1)} type="button">
            Refresh
          </button>
          <Link className="button ghost" href="/">
            Dashboard
          </Link>
        </>
      }
    >
      <section className="panel pad">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Queue view</h2>
            <p className="panel-subtitle">
              Use the posts tab for content review and the reports tab for
              safety escalation, warnings, removals, and suspensions.
            </p>
          </div>
          <div className="tabs" role="tablist" aria-label="Review tabs">
            <button
              className="tab"
              data-active={tab === "posts" ? "true" : "false"}
              onClick={() => setTab("posts")}
              type="button"
            >
              Posts
            </button>
            <button
              className="tab"
              data-active={tab === "reports" ? "true" : "false"}
              onClick={() => setTab("reports")}
              type="button"
            >
              Reports
            </button>
          </div>
        </div>

        {error ? (
          <div className="hero-callout">
            <strong>Queue error</strong>
            <div className="muted">{error}</div>
          </div>
        ) : null}

        <div className="list">
          {loading ? <div className="list-empty">Loading moderation queue...</div> : null}
          {!loading && items.length === 0 ? (
            <div className="list-empty">{emptyText}</div>
          ) : null}

          {items.map((item, index) => {
            const key =
              item.post_id ?? item.report_id ?? item.title ?? item.created_at ?? String(index);
            const decisionBase = `${tab}:${item.post_id ?? item.report_id ?? key}`;
            return (
              <article key={key} className="item">
                <div className="item-head">
                  <div>
                    <h3 className="item-title">{itemTitle(item, tab)}</h3>
                    <div className="item-meta">
                      <span className="badge warning">{queueLabel(item, tab)}</span>
                      <span className="badge">{item.status ?? "new"}</span>
                      {item.community_id ? <span className="badge info">{item.community_id}</span> : null}
                    </div>
                  </div>
                  <div className="item-meta">
                    {item.created_at ? <span className="badge">{item.created_at}</span> : null}
                  </div>
                </div>

                <p className="item-body">{itemSubtitle(item, tab)}</p>

                <div className="card-actions">
                  {tab === "posts" ? (
                    <>
                      <button
                        className="button primary small"
                        disabled={busyKey === `${decisionBase}:approve`}
                        onClick={() => void handleDecision(item, "approve")}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="button secondary small"
                        disabled={busyKey === `${decisionBase}:reject`}
                        onClick={() => void handleDecision(item, "reject")}
                        type="button"
                      >
                        Reject
                      </button>
                      <button
                        className="button ghost small"
                        disabled={busyKey === `${decisionBase}:request_more_info`}
                        onClick={() => void handleDecision(item, "request_more_info")}
                        type="button"
                      >
                        Need more info
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="button secondary small"
                        disabled={busyKey === `${decisionBase}:dismiss`}
                        onClick={() => void handleDecision(item, "dismiss")}
                        type="button"
                      >
                        Dismiss
                      </button>
                      <button
                        className="button primary small"
                        disabled={busyKey === `${decisionBase}:warn`}
                        onClick={() => void handleDecision(item, "warn")}
                        type="button"
                      >
                        Warn
                      </button>
                      <button
                        className="button ghost small"
                        disabled={busyKey === `${decisionBase}:remove_post`}
                        onClick={() => void handleDecision(item, "remove_post")}
                        type="button"
                      >
                        Remove post
                      </button>
                      <button
                        className="button danger small"
                        disabled={busyKey === `${decisionBase}:suspend_user`}
                        onClick={() => void handleDecision(item, "suspend_user")}
                        type="button"
                      >
                        Suspend user
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="panel-subtitle" style={{ marginTop: 16 }}>
          Cursor: {cursor ?? "none"}
        </div>
      </section>
    </AdminShell>
  );
}
