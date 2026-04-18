"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  type AnchorActivateResponse,
  isRecord,
  normalizeAuthSession,
  readString,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

const INVALID_TOTP_MESSAGE =
  "That code is invalid — wait for your authenticator to show a new 6-digit code, then try again.";

function extractSecretFromOtpauthUri(uri: string): string | null {
  try {
    const parsed = new URL(uri);
    const secret = parsed.searchParams.get("secret");
    return secret && secret.trim().length > 0 ? secret.trim() : null;
  } catch {
    const match = uri.match(/[?&]secret=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

function getErrorStatus(error: unknown): number | null {
  if (isRecord(error)) {
    const status = error["status"];
    if (typeof status === "number" && Number.isFinite(status)) {
      return status;
    }
  }
  return null;
}

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

function readConfirmError(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 400 || status === 401) {
    return INVALID_TOTP_MESSAGE;
  }
  return readErrorMessage(error);
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to fallback
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
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
  const [secretCopied, setSecretCopied] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const manualSecret = useMemo(
    () =>
      activation?.otpauth_uri
        ? extractSecretFromOtpauthUri(activation.otpauth_uri)
        : null,
    [activation?.otpauth_uri],
  );

  useEffect(() => {
    if (!qrCanvasRef.current || !activation?.otpauth_uri) {
      return;
    }

    QRCode.toCanvas(qrCanvasRef.current, activation.otpauth_uri, {
      width: 220,
      margin: 1,
      color: { dark: "#1d1a16", light: "#ffffff" },
    }).catch(() => {
      // graceful failure — manual secret still shown below
    });
  }, [activation?.otpauth_uri]);

  useEffect(() => {
    if (!secretCopied) return;
    const id = window.setTimeout(() => setSecretCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [secretCopied]);

  useEffect(() => {
    if (!recoveryCopied) return;
    const id = window.setTimeout(() => setRecoveryCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [recoveryCopied]);

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
      setError(readConfirmError(requestError));
    } finally {
      setLoading(null);
    }
  };

  const handleCopySecret = async () => {
    if (!manualSecret) return;
    const ok = await copyToClipboard(manualSecret);
    if (ok) setSecretCopied(true);
  };

  const handleCopyAll = async () => {
    const codes = activation?.recovery_codes;
    if (!codes || codes.length === 0) return;
    const ok = await copyToClipboard(codes.join("\n"));
    if (ok) setRecoveryCopied(true);
  };

  const handleDownload = () => {
    if (!activation?.recovery_codes || activation.recovery_codes.length === 0) {
      return;
    }

    const communityName =
      activation.community?.name ?? activation.community?.community_id ?? "Unknown";
    const communityId = activation.community?.community_id ?? "unknown";
    const text = `WeaveNYC Anchor Recovery Codes
Community: ${communityName}
Generated: ${new Date().toISOString()}

Recovery codes (single-use, save offline):

${activation.recovery_codes.join("\n")}

If you lose your authenticator app, use one of these codes at /login > Recovery code.
`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weavenyc-anchor-recovery-codes-${communityId.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            </div>

            {activation?.otpauth_uri ? (
              <div className="activation-qr">
                <strong>Scan with your authenticator app</strong>
                <canvas
                  ref={qrCanvasRef}
                  data-testid="anchor-activate-qr"
                  aria-label="TOTP setup QR code"
                />
                <details>
                  <summary>Can&rsquo;t scan? Enter secret manually</summary>
                  {manualSecret ? (
                    <div className="activation-qr-manual">
                      <code>{manualSecret}</code>
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void handleCopySecret()}
                        data-testid="anchor-activate-secret-copy"
                      >
                        {secretCopied ? "Copied \u2713" : "Copy"}
                      </button>
                    </div>
                  ) : (
                    <code>{activation.otpauth_uri}</code>
                  )}
                </details>
              </div>
            ) : null}

            {activation?.recovery_codes?.length ? (
              <div
                className="recovery-codes-block"
                data-testid="anchor-activate-recovery-codes"
              >
                <strong>Your recovery codes — save these NOW</strong>
                <p className="warning">
                  These will not be shown again. Keep them somewhere safe and
                  offline.
                </p>
                <ul className="recovery-codes-list">
                  {activation.recovery_codes.map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ul>
                <div className="action-row">
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => void handleCopyAll()}
                    data-testid="recovery-codes-copy"
                  >
                    {recoveryCopied ? "Copied \u2713" : "Copy all"}
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={handleDownload}
                    data-testid="recovery-codes-download"
                  >
                    Download as .txt
                  </button>
                </div>
              </div>
            ) : null}
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
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                placeholder="000000"
                data-testid="anchor-activate-totp-input"
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
