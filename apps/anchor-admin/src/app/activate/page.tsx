"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  type AnchorActivateResponse,
  isRecord,
  normalizeAuthSession,
  readString,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

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

export default function ActivatePage() {
  const router = useRouter();
  const { isAuthenticated, isVerified, requestJson, selectedCommunityId, signInWithTokens } =
    useAuth();

  const [inviteCodeDraft, setInviteCodeDraft] = useState("");
  const [activation, setActivation] = useState<AnchorActivateResponse | null>(null);
  const [totpCodeDraft, setTotpCodeDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const intro = useMemo(() => {
    if (!isAuthenticated) {
      return "Anchor activation needs a verified session. Restore one from /login before enrolling a new anchor invite.";
    }

    if (!isVerified) {
      return "The current session is not verified yet. Use the login page to step up first.";
    }

    return "Enroll the invite code, then confirm the TOTP challenge to activate anchor access.";
  }, [isAuthenticated, isVerified]);

  const handleStartActivation = async () => {
    setError(null);
    setMessage(null);

    if (!inviteCodeDraft.trim()) {
      setError("Enter an invite code before starting activation.");
      return;
    }

    setLoading("start");
    try {
      const response = await requestJson<AnchorActivateResponse>(
        "/v1/auth/anchor/activate",
        {
          method: "POST",
          body: {
            invite_code: inviteCodeDraft.trim(),
          },
        },
      );
      setActivation(response);
      setMessage(
        `Enrollment ready for ${response.community?.name ?? response.community?.community_id ?? "the selected community"}.`,
      );
      setTotpCodeDraft("");
    } catch (requestError) {
      setError(readErrorMessage(requestError));
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmActivation = async () => {
    setError(null);
    setMessage(null);

    if (!activation?.activation_id) {
      setError("Start the activation flow first.");
      return;
    }

    if (!totpCodeDraft.trim()) {
      setError("Enter the TOTP code from your authenticator app.");
      return;
    }

    setLoading("confirm");
    try {
      const response = await requestJson(
        "/v1/auth/anchor/activate/confirm",
        {
          method: "POST",
          body: {
            activation_id: activation.activation_id,
            totp_code: totpCodeDraft.trim(),
          },
        },
      );
      const session = normalizeAuthSession(response);
      if (!session) {
        throw new Error("Activation response did not contain session tokens.");
      }

      signInWithTokens(session, {
        selectedCommunityId:
          activation.community?.community_id ?? selectedCommunityId ?? null,
      });
      router.push("/");
    } catch (requestError) {
      setError(readErrorMessage(requestError));
    } finally {
      setLoading(null);
    }
  };

  return (
    <AdminShell
      eyebrow="M5 Anchor Activation"
      title="Activate anchor"
      subtitle="Complete the invite-based enrollment flow with TOTP enrollment and session issuance."
      actions={
        <>
          <Link className="button secondary" href="/login">
            Start session
          </Link>
          <Link className="button ghost" href="/">
            Dashboard
          </Link>
        </>
      }
    >
      <section className="hero">
        <div className="hero-actions">
          <Link className="button primary" href="/login">
            Login first
          </Link>
          <Link className="button ghost" href="/review">
            Open review queue
          </Link>
        </div>
        <div className="hero-callout">
          <strong>Activation status</strong>
          <div className="muted">{intro}</div>
        </div>
      </section>

      {message ? (
        <section className="panel pad">
          <div className="badge success">Ready</div>
          <p className="panel-subtitle">{message}</p>
        </section>
      ) : null}

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
              <h2 className="panel-title">Invite enrollment</h2>
              <p className="panel-subtitle">
                Start the anchor activation flow using the invite code that the
                platform issued for this community.
              </p>
            </div>
          </div>

          <div className="stack">
            <label className="field">
              <span className="field-label">Invite code</span>
              <input
                className="input"
                placeholder="ANC-XXXXX"
                value={inviteCodeDraft}
                onChange={(event) => setInviteCodeDraft(event.target.value)}
              />
            </label>

            <div className="button-row">
              <button
                className="button primary"
                disabled={loading === "start" || !isVerified}
                onClick={() => void handleStartActivation()}
                type="button"
              >
                {loading === "start" ? "Starting..." : "Start activation"}
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setInviteCodeDraft("");
                  setActivation(null);
                }}
                type="button"
              >
                Reset
              </button>
            </div>

            <div className="hero-callout">
              <strong>Activation challenge</strong>
              <div className="muted">
                {activation?.activation_id
                  ? activation.activation_id
                  : "No activation id yet."}
              </div>
              {activation?.otpauth_uri ? (
                <div className="muted">
                  otpauth uri: <span className="inline-kbd">{activation.otpauth_uri}</span>
                </div>
              ) : null}
              {activation?.recovery_codes?.length ? (
                <div className="muted">
                  Recovery codes:{" "}
                  <span className="inline-kbd">
                    {activation.recovery_codes.join(" · ")}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">TOTP confirmation</h2>
              <p className="panel-subtitle">
                Confirm the enrollment with the authenticator code to finish
                activation and issue anchor session tokens.
              </p>
            </div>
          </div>

          <div className="stack">
            <label className="field">
              <span className="field-label">TOTP code</span>
              <input
                className="input"
                inputMode="numeric"
                placeholder="123456"
                value={totpCodeDraft}
                onChange={(event) => setTotpCodeDraft(event.target.value)}
              />
            </label>

            <div className="button-row">
              <button
                className="button primary"
                disabled={loading === "confirm" || !activation?.activation_id}
                onClick={() => void handleConfirmActivation()}
                type="button"
              >
                {loading === "confirm" ? "Confirming..." : "Confirm activation"}
              </button>
              <Link className="button ghost" href="/login">
                Step up session instead
              </Link>
            </div>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
