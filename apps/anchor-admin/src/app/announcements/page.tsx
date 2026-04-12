"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  type AnnouncementItem,
  type AnnouncementListResponse,
  isRecord,
  readString,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type AnnouncementDraft = {
  title: string;
  body: string;
  pinned: boolean;
};

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

function normalizeAnnouncements(payload: unknown): AnnouncementItem[] {
  if (Array.isArray(payload)) {
    return payload as AnnouncementItem[];
  }

  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items as AnnouncementItem[];
  }

  return [];
}

function emptyDraft(): AnnouncementDraft {
  return {
    title: "",
    body: "",
    pinned: false,
  };
}

export default function AnnouncementsPage() {
  const { isAnchor, requestJson, selectedCommunityId } = useAuth();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAnnouncements() {
      if (!isAnchor || !selectedCommunityId) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload = await requestJson<AnnouncementListResponse>(
          `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/announcements`,
        );
        if (!cancelled) {
          setItems(normalizeAnnouncements(payload));
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

    void loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [isAnchor, refreshNonce, requestJson, selectedCommunityId]);

  const pageState = useMemo(() => {
    if (!isAnchor) {
      return "Anchor session required before announcements can be edited.";
    }

    if (!selectedCommunityId) {
      return "Set a community id in the header to load announcements.";
    }

    return "Create and publish community announcements from this panel. The pinned flag only changes community ordering when rules use the manual pin strategy.";
  }, [isAnchor, selectedCommunityId]);

  const handleSave = async () => {
    if (!selectedCommunityId) {
      return;
    }

    if (!draft.title.trim() || !draft.body.trim()) {
      setError("Title and body are required.");
      return;
    }

    const payload = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      is_pinned: draft.pinned,
    };

    setSaving(editingId ?? "new");
    setError(null);

    try {
      if (editingId) {
        await requestJson(
          `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/announcements/${encodeURIComponent(editingId)}`,
          {
            method: "PATCH",
            body: payload,
          },
        );
      } else {
        await requestJson(
          `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/announcements`,
          {
            method: "POST",
            body: payload,
          },
        );
      }

      setDraft(emptyDraft());
      setEditingId(null);
      setRefreshNonce((value) => value + 1);
    } catch (requestError) {
      setError(readErrorMessage(requestError));
    } finally {
      setSaving(null);
    }
  };

  const handleEdit = (item: AnnouncementItem) => {
    setEditingId(item.announcement_id ?? null);
    setDraft({
      title: item.title ?? "",
      body: item.body ?? "",
      pinned: Boolean(item.pinned ?? item.is_pinned),
    });
  };

  const handleDelete = async (item: AnnouncementItem) => {
    if (!selectedCommunityId || !item.announcement_id) {
      return;
    }

    setSaving(`delete:${item.announcement_id}`);
    try {
      await requestJson(
        `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/announcements/${encodeURIComponent(item.announcement_id)}`,
        {
          method: "DELETE",
        },
      );
      setRefreshNonce((value) => value + 1);
      if (editingId === item.announcement_id) {
        setEditingId(null);
        setDraft(emptyDraft());
      }
    } catch (requestError) {
      setError(readErrorMessage(requestError));
    } finally {
      setSaving(null);
    }
  };

  const handleTogglePin = async (item: AnnouncementItem) => {
    if (!selectedCommunityId || !item.announcement_id) {
      return;
    }

    const isPinned = item.pinned ?? item.is_pinned ?? false;
    setSaving(`pin:${item.announcement_id}`);
    try {
      await requestJson(
        `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/announcements/${encodeURIComponent(item.announcement_id)}`,
        {
          method: "PATCH",
          body: {
            title: item.title ?? "",
            body: item.body ?? "",
            is_pinned: !isPinned,
          },
        },
      );
      setRefreshNonce((value) => value + 1);
    } catch (requestError) {
      setError(readErrorMessage(requestError));
    } finally {
      setSaving(null);
    }
  };

  return (
    <AdminShell
      eyebrow="M5 Communications"
      title="Announcements"
      subtitle="Publish, edit, flag, or remove community announcements without leaving the admin shell."
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
      <section className="hero">
        <div className="hero-actions">
          <button
            className="button primary"
            onClick={() => {
              setEditingId(null);
              setDraft(emptyDraft());
            }}
            type="button"
          >
            New announcement
          </button>
          <Link className="button ghost" href="/rules">
            Open rules
          </Link>
        </div>
        <div className="hero-callout">
          <strong>Page state</strong>
          <div className="muted">{pageState}</div>
        </div>
      </section>

      {error ? (
        <section className="panel pad">
          <div className="badge danger">Error</div>
          <p className="panel-subtitle">{error}</p>
        </section>
      ) : null}

      <section className="split">
        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">
                {editingId ? "Edit announcement" : "Create announcement"}
              </h2>
              <p className="panel-subtitle">
                Keep the announcement content concise and pin only the messages
                that should remain at the top of the community page.
              </p>
            </div>
          </div>

          <div className="stack">
            <label className="field">
              <span className="field-label">Title</span>
              <input
                className="input"
                placeholder="Community hours update"
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Body</span>
              <textarea
                className="textarea"
                placeholder="Add the community-facing message here."
                value={draft.body}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, body: event.target.value }))
                }
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span className="field-label">Pinned flag</span>
                <select
                  className="select"
                  value={draft.pinned ? "yes" : "no"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pinned: event.target.value === "yes",
                    }))
                  }
                >
                  <option value="no">no</option>
                  <option value="yes">yes</option>
                </select>
                <span className="field-help">
                  This flag only affects community banner ordering when the active rule set uses the manual pin strategy.
                </span>
              </label>
            </div>

            <div className="button-row">
              <button
                className="button primary"
                disabled={saving !== null || !selectedCommunityId}
                onClick={() => void handleSave()}
                type="button"
              >
                {saving === (editingId ?? "new") ? "Saving..." : editingId ? "Save changes" : "Publish"}
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setDraft(emptyDraft());
                  setEditingId(null);
                }}
                type="button"
              >
                Reset form
              </button>
            </div>
          </div>
        </div>

        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Current announcements</h2>
              <p className="panel-subtitle">
                These are the active or recently published items returned from
                the community API.
              </p>
            </div>
          </div>

          <div className="list">
            {loading ? <div className="list-empty">Loading announcements...</div> : null}
            {!loading && items.length === 0 ? (
              <div className="list-empty">
                No announcements yet. Publish the first one from the editor.
              </div>
            ) : null}

            {items.map((item, index) => {
              const isPinned = item.pinned ?? item.is_pinned ?? false;

              return (
                <article key={item.announcement_id ?? item.title ?? String(index)} className="item">
                  <div className="item-head">
                    <div>
                      <h3 className="item-title">{item.title ?? "Untitled announcement"}</h3>
                      <div className="item-meta">
                        <span className="badge info">{item.status ?? "active"}</span>
                        {isPinned ? <span className="badge success">Pinned</span> : null}
                        {item.published_at ? <span className="badge">{item.published_at}</span> : null}
                      </div>
                    </div>
                  </div>

                  <p className="item-body">{item.body ?? "No body text available."}</p>

                  <div className="card-actions">
                      <button
                        className="button secondary small"
                        disabled={saving === `pin:${item.announcement_id ?? ""}`}
                        onClick={() => void handleTogglePin(item)}
                        type="button"
                      >
                        {isPinned ? "Clear pinned flag" : "Set pinned flag"}
                      </button>
                    <button className="button ghost small" onClick={() => handleEdit(item)} type="button">
                      Edit
                    </button>
                    <button
                      className="button danger small"
                      disabled={saving === `delete:${item.announcement_id ?? ""}`}
                      onClick={() => void handleDelete(item)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
