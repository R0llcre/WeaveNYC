"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  type CommunityRules,
  type CommunityRulesResponse,
  isRecord,
  readString,
  readStringArray,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type RulesDraft = {
  review_categories: string;
  auto_hide_report_threshold: string;
  keyword_blocklist: string;
  language_preferences: string;
  announcement_pin_strategy: string;
};

const defaultDraft: RulesDraft = {
  review_categories: "childcare, transportation",
  auto_hide_report_threshold: "3",
  keyword_blocklist: "",
  language_preferences: "en,es,zh",
  announcement_pin_strategy: "latest",
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

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function draftFromRules(rules: CommunityRules): RulesDraft {
  return {
    review_categories: rules.review_categories.join(", "),
    auto_hide_report_threshold: String(rules.auto_hide_report_threshold),
    keyword_blocklist: rules.keyword_blocklist.join(", "),
    language_preferences: rules.language_preferences.join(", "),
    announcement_pin_strategy: rules.announcement_pin_strategy,
  };
}

function normalizeRules(payload: unknown): CommunityRules | null {
  if (!isRecord(payload)) {
    return null;
  }

  const reviewCategories = readStringArray(payload, "review_categories");
  const keywordBlocklist = readStringArray(payload, "keyword_blocklist");
  const languagePreferences = readStringArray(payload, "language_preferences");
  const autoHideReportThreshold = payload.auto_hide_report_threshold;
  const announcementPinStrategy = readString(
    payload,
    "announcement_pin_strategy",
  );

  if (
    !reviewCategories ||
    !keywordBlocklist ||
    !languagePreferences ||
    typeof autoHideReportThreshold !== "number" ||
    !announcementPinStrategy
  ) {
    return null;
  }

  return {
    review_categories: reviewCategories,
    auto_hide_report_threshold: autoHideReportThreshold,
    keyword_blocklist: keywordBlocklist,
    language_preferences: languagePreferences,
    announcement_pin_strategy: announcementPinStrategy,
  };
}

export default function RulesPage() {
  const { isAnchor, requestJson, selectedCommunityId } = useAuth();
  const [rules, setRules] = useState<CommunityRules | null>(null);
  const [draft, setDraft] = useState<RulesDraft>(defaultDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadRules() {
      if (!isAnchor || !selectedCommunityId) {
        setRules(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload = await requestJson<CommunityRulesResponse>(
          `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/rules`,
        );
        const normalized = normalizeRules(payload);
        if (!cancelled) {
          setRules(normalized);
          if (normalized) {
            setDraft(draftFromRules(normalized));
          }
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(readErrorMessage(fetchError));
          setRules(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRules();

    return () => {
      cancelled = true;
    };
  }, [isAnchor, refreshNonce, requestJson, selectedCommunityId]);

  const pageState = useMemo(() => {
    if (!isAnchor) {
      return "Anchor session required before rules can be edited.";
    }

    if (!selectedCommunityId) {
      return "Set a community id in the header to load rules.";
    }

    return "Rules apply to new moderation decisions and new content only.";
  }, [isAnchor, selectedCommunityId]);

  const handleSave = async () => {
    if (!selectedCommunityId) {
      return;
    }

    const parsedThreshold = Number(draft.auto_hide_report_threshold);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold <= 0) {
      setError("Auto-hide threshold must be a positive number.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await requestJson(
        `/v1/admin/communities/${encodeURIComponent(selectedCommunityId)}/rules`,
        {
          method: "PUT",
          body: {
            review_categories: splitCsv(draft.review_categories),
            auto_hide_report_threshold: parsedThreshold,
            keyword_blocklist: splitCsv(draft.keyword_blocklist),
            language_preferences: splitCsv(draft.language_preferences),
            announcement_pin_strategy: draft.announcement_pin_strategy,
          },
        },
      );
      setRefreshNonce((value) => value + 1);
    } catch (requestError) {
      setError(readErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      eyebrow="M5 Governance"
      title="Rules"
      subtitle="Tune moderation categories, thresholds, and announcement policy from one form."
      actions={
        <>
          <button className="button secondary" onClick={() => setRefreshNonce((v) => v + 1)} type="button">
            Reload
          </button>
          <Link className="button ghost" href="/">
            Dashboard
          </Link>
        </>
      }
    >
      <section className="hero">
        <div className="hero-actions">
          <Link className="button primary" href="/announcements">
            Announcements
          </Link>
          <Link className="button ghost" href="/review">
            Review queue
          </Link>
        </div>
        <div className="hero-callout">
          <strong>Policy scope</strong>
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
              <h2 className="panel-title">Rule editor</h2>
              <p className="panel-subtitle">
                Keep the rule surface small and explicit so moderation behavior
                stays predictable.
              </p>
            </div>
          </div>

          <div className="stack">
            <label className="field">
              <span className="field-label">Review categories</span>
              <textarea
                className="textarea"
                value={draft.review_categories}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, review_categories: event.target.value }))
                }
              />
              <span className="field-help">Comma-separated values.</span>
            </label>

            <label className="field">
              <span className="field-label">Auto-hide report threshold</span>
              <input
                className="input"
                inputMode="numeric"
                value={draft.auto_hide_report_threshold}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    auto_hide_report_threshold: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Keyword blocklist</span>
              <textarea
                className="textarea"
                value={draft.keyword_blocklist}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, keyword_blocklist: event.target.value }))
                }
              />
              <span className="field-help">Used for new post and announcement edits.</span>
            </label>

            <div className="field-grid">
              <label className="field">
                <span className="field-label">Language preferences</span>
                <textarea
                  className="textarea"
                  value={draft.language_preferences}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      language_preferences: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">Announcement pin strategy</span>
                <select
                  className="select"
                  value={draft.announcement_pin_strategy}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      announcement_pin_strategy: event.target.value,
                    }))
                  }
                >
                  <option value="latest">latest</option>
                  <option value="manual">manual</option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button
                className="button primary"
                disabled={saving || !selectedCommunityId}
                onClick={() => void handleSave()}
                type="button"
              >
                {saving ? "Saving..." : "Save rules"}
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  if (rules) {
                    setDraft(draftFromRules(rules));
                  } else {
                    setDraft(defaultDraft);
                  }
                }}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Current policy snapshot</h2>
              <p className="panel-subtitle">
                Review the active rule set before publishing changes.
              </p>
            </div>
          </div>

          <div className="list">
            {loading ? <div className="list-empty">Loading rules...</div> : null}
            {!loading && !rules ? (
              <div className="list-empty">
                No rules loaded yet. Save a community id in the header and reload.
              </div>
            ) : null}

            {rules ? (
              <>
                <div className="item">
                  <div className="item-head">
                    <h3 className="item-title">Review categories</h3>
                    <span className="badge info">{rules.review_categories.length}</span>
                  </div>
                  <p className="item-body">{rules.review_categories.join(", ")}</p>
                </div>
                <div className="item">
                  <div className="item-head">
                    <h3 className="item-title">Auto-hide threshold</h3>
                    <span className="badge warning">{rules.auto_hide_report_threshold}</span>
                  </div>
                  <p className="item-body">
                    Only post-target reports reach automatic hide behavior.
                  </p>
                </div>
                <div className="item">
                  <div className="item-head">
                    <h3 className="item-title">Keyword blocklist</h3>
                    <span className="badge info">{rules.keyword_blocklist.length}</span>
                  </div>
                  <p className="item-body">{rules.keyword_blocklist.join(", ") || "No blocklist configured."}</p>
                </div>
                <div className="item">
                  <div className="item-head">
                    <h3 className="item-title">Language preferences</h3>
                    <span className="badge success">{rules.language_preferences.length}</span>
                  </div>
                  <p className="item-body">{rules.language_preferences.join(", ")}</p>
                </div>
                <div className="item">
                  <div className="item-head">
                    <h3 className="item-title">Announcement pin strategy</h3>
                    <span className="badge">{rules.announcement_pin_strategy}</span>
                  </div>
                  <p className="item-body">This controls how the community banner is ordered.</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
