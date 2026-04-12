"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  type AnchorSessionStartResponse,
  type AnchorSessionVerifyResponse,
  type MagicLinkStartResponse,
  type MagicLinkVerifyResponse,
  type OtpStartResponse,
  type OtpVerifyResponse,
  isRecord,
  normalizeAuthSession,
  readString,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type LoginMode = "otp" | "magic";

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

export default function LoginPage() {
  const router = useRouter();
  const {
    accessToken,
    isAnchor,
    isAuthenticated,
    isVerified,
    requestJson,
    selectedCommunityId,
    signInWithTokens,
  } = useAuth();

  const [mode, setMode] = useState<LoginMode>("otp");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCodeDraft, setOtpCodeDraft] = useState("");
  const [magicTokenDraft, setMagicTokenDraft] = useState("");
  const [communityIdDraft, setCommunityIdDraft] = useState(selectedCommunityId ?? "");
  const [devAccessTokenDraft, setDevAccessTokenDraft] = useState("");
  const [devRefreshTokenDraft, setDevRefreshTokenDraft] = useState("");
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [challengeAccessToken, setChallengeAccessToken] = useState<string | null>(null);
  const [anchorChallengeId, setAnchorChallengeId] = useState<string | null>(null);
  const [anchorTotpCodeDraft, setAnchorTotpCodeDraft] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setReason(params.get("reason"));
  }, []);

  const intro = useMemo(() => {
    if (reason === "idle") {
      return "Your admin session expired after 4 hours of inactivity.";
    }

    if (reason === "session") {
      return "The stored refresh token could not be reused. Load a fresh verified session.";
    }

    return "Use OTP or magic link to obtain a verified session, then either activate a new anchor invite or complete TOTP step-up for an existing anchor.";
  }, [reason]);

  const resolvedCommunityId = communityIdDraft.trim() || selectedCommunityId || "";

  const handleVerifiedSessionReady = (session: ReturnType<typeof normalizeAuthSession>) => {
    if (!session) {
      throw new Error("Authentication response did not contain session tokens.");
    }

    signInWithTokens(session, {
      selectedCommunityId: resolvedCommunityId || null,
    });
    setAnchorChallengeId(null);
    setAnchorTotpCodeDraft("");
    setDevMessage(
      "Verified session loaded. Continue with invite activation or start anchor TOTP step-up below.",
    );
  };

  const ensureChallengeSession = async () => {
    if (accessToken) {
      return accessToken;
    }

    const bootstrap = await requestJson("/v1/auth/anonymous", {
      method: "POST",
      auth: false,
      body: {
        device_id: crypto.randomUUID(),
      },
    });
    const session = normalizeAuthSession(bootstrap);
    if (!session) {
      throw new Error("Anonymous bootstrap session could not be created.");
    }

    signInWithTokens(session, {
      selectedCommunityId: communityIdDraft.trim() || null,
    });
    setChallengeAccessToken(session.accessToken);
    return session.accessToken;
  };

  const handleOtpStart = async () => {
    setLoginError(null);
    setDevMessage(null);

    if (!phoneDraft.trim()) {
      setLoginError("Enter a phone number before requesting an OTP challenge.");
      return;
    }

    setLoading("otp-start");
    try {
      const token = await ensureChallengeSession();
      const response = await requestJson<OtpStartResponse>("/v1/auth/otp/start", {
        method: "POST",
        auth: false,
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: {
          phone: phoneDraft.trim(),
        },
      });
      setChallengeId(response.challenge_id);
      setChallengeAccessToken(token);
      setOtpCodeDraft("");
      setDevMessage(
        `OTP challenge created${response.expires_in_seconds ? `, expires in ${response.expires_in_seconds} seconds` : ""}.`,
      );
    } catch (error) {
      setLoginError(readErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleOtpVerify = async () => {
    setLoginError(null);
    setDevMessage(null);

    if (!challengeId) {
      setLoginError("Start an OTP challenge first.");
      return;
    }

    if (!otpCodeDraft.trim()) {
      setLoginError("Enter the 6 digit OTP code.");
      return;
    }

    setLoading("otp-verify");
    try {
      const token = accessToken ?? challengeAccessToken;
      if (!token) {
        throw new Error("Start an OTP challenge first.");
      }

      const response = await requestJson<OtpVerifyResponse>("/v1/auth/otp/verify", {
        method: "POST",
        auth: false,
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: {
          challenge_id: challengeId,
          code: otpCodeDraft.trim(),
        },
      });
      handleVerifiedSessionReady(normalizeAuthSession(response));
    } catch (error) {
      setLoginError(readErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleMagicStart = async () => {
    setLoginError(null);
    setDevMessage(null);

    if (!emailDraft.trim()) {
      setLoginError("Enter an email address before requesting a magic link.");
      return;
    }

    setLoading("magic-start");
    try {
      const token = await ensureChallengeSession();
      const response = await requestJson<MagicLinkStartResponse>(
        "/v1/auth/magic-link/start",
        {
          method: "POST",
          auth: false,
          headers: {
            authorization: `Bearer ${token}`,
          },
          body: {
            email: emailDraft.trim(),
          },
        },
      );
      setChallengeId(response.challenge_id);
      setChallengeAccessToken(token);
      setMagicTokenDraft("");
      setDevMessage(
        `Magic link challenge created${response.expires_in_seconds ? `, expires in ${response.expires_in_seconds} seconds` : ""}.`,
      );
    } catch (error) {
      setLoginError(readErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleMagicVerify = async () => {
    setLoginError(null);
    setDevMessage(null);

    if (!challengeId) {
      setLoginError("Start a magic link challenge first.");
      return;
    }

    if (!magicTokenDraft.trim()) {
      setLoginError("Enter the one-time magic link token.");
      return;
    }

    setLoading("magic-verify");
    try {
      const token = accessToken ?? challengeAccessToken;
      const response = await requestJson<MagicLinkVerifyResponse>(
        "/v1/auth/magic-link/verify",
        {
          method: "POST",
          auth: false,
          headers: token
            ? {
                authorization: `Bearer ${token}`,
              }
            : undefined,
          body: {
            challenge_id: challengeId,
            token: magicTokenDraft.trim(),
          },
        },
      );
      const session = normalizeAuthSession(response);
      handleVerifiedSessionReady(session);
    } catch (error) {
      setLoginError(readErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleAnchorSessionStart = async () => {
    setLoginError(null);
    setDevMessage(null);

    if (!isVerified) {
      setLoginError("Load a verified session before starting anchor TOTP step-up.");
      return;
    }

    if (!resolvedCommunityId) {
      setLoginError("Enter or restore the community id before starting anchor TOTP step-up.");
      return;
    }

    setLoading("anchor-start");
    try {
      const response = await requestJson<AnchorSessionStartResponse>(
        "/v1/auth/anchor/session/start",
        {
          method: "POST",
          body: {
            community_id: resolvedCommunityId,
          },
        },
      );
      setAnchorChallengeId(response.challenge_id);
      setAnchorTotpCodeDraft("");
      setDevMessage(
        `Anchor step-up challenge created${response.expires_in_seconds ? `, expires in ${response.expires_in_seconds} seconds` : ""}.`,
      );
    } catch (error) {
      setLoginError(readErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleAnchorSessionVerify = async () => {
    setLoginError(null);
    setDevMessage(null);

    if (!anchorChallengeId) {
      setLoginError("Start an anchor step-up challenge first.");
      return;
    }

    if (!anchorTotpCodeDraft.trim()) {
      setLoginError("Enter the 6 digit TOTP code.");
      return;
    }

    setLoading("anchor-verify");
    try {
      const response = await requestJson<AnchorSessionVerifyResponse>(
        "/v1/auth/anchor/session/verify",
        {
          method: "POST",
          body: {
            challenge_id: anchorChallengeId,
            totp_code: anchorTotpCodeDraft.trim(),
          },
        },
      );
      const session = normalizeAuthSession(response);
      if (!session) {
        throw new Error("Anchor step-up response did not contain session tokens.");
      }

      signInWithTokens(session, {
        selectedCommunityId: resolvedCommunityId || null,
      });
      router.push("/");
    } catch (error) {
      setLoginError(readErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleDevBootstrap = () => {
    setLoginError(null);
    setDevMessage(null);

    if (!devAccessTokenDraft.trim() || !devRefreshTokenDraft.trim()) {
      setLoginError("Paste both access and refresh tokens to bootstrap the shell.");
      return;
    }

    const session = normalizeAuthSession({
      access_token: devAccessTokenDraft.trim(),
      refresh_token: devRefreshTokenDraft.trim(),
    });
    if (!session) {
      setLoginError("Token pair was not valid.");
      return;
    }

    signInWithTokens(session, {
      selectedCommunityId: communityIdDraft.trim() || null,
    });
    setDevMessage("Session loaded into the admin shell.");
  };

  return (
    <AdminShell
      eyebrow="M5 Anchor Login"
      title="Start anchor session"
      subtitle="Obtain a verified session with OTP or magic link, then step into the anchor console for the selected community."
    >
      <section className="hero">
        <div className="hero-actions">
          <Link className="button secondary" href="/activate">
            Go to activation
          </Link>
          <Link className="button ghost" href="/">
            Back to dashboard
          </Link>
        </div>
        <div className="hero-callout">
          <strong>Session state</strong>
          <div className="muted">
            {isAuthenticated
              ? isVerified
                ? isAnchor
                  ? "An anchor-capable session is already present. Start TOTP step-up below or move into the console."
                  : "A verified session is already present. Continue with invite activation or, if this user is already an anchor, start TOTP step-up below."
                : "A session is loaded, but it is not yet verified."
              : intro}
          </div>
        </div>
      </section>

      {devMessage ? (
        <section className="panel pad">
          <div className="badge success">Ready</div>
          <p className="panel-subtitle">{devMessage}</p>
        </section>
      ) : null}

      {loginError ? (
        <section className="panel pad">
          <div className="badge danger">Error</div>
          <p className="panel-subtitle">{loginError}</p>
        </section>
      ) : null}

      <section className="split">
        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Verified session</h2>
              <p className="panel-subtitle">
                Use OTP as the primary verified path. Magic link remains the fallback path.
              </p>
            </div>
            <div className="tabs" role="tablist" aria-label="Login modes">
              <button
                className="tab"
                data-active={mode === "otp" ? "true" : "false"}
                onClick={() => {
                  setMode("otp");
                  setChallengeId(null);
                }}
                type="button"
              >
                OTP
              </button>
              <button
                className="tab"
                data-active={mode === "magic" ? "true" : "false"}
                onClick={() => {
                  setMode("magic");
                  setChallengeId(null);
                }}
                type="button"
              >
                Magic link
              </button>
            </div>
          </div>

          {mode === "otp" ? (
            <div className="stack">
              <label className="field">
                <span className="field-label">Phone number</span>
                <input
                  className="input"
                  placeholder="+1516..."
                  value={phoneDraft}
                  onChange={(event) => setPhoneDraft(event.target.value)}
                />
                <span className="field-help">
                  This matches the contract for <code>/v1/auth/otp/start</code>.
                </span>
              </label>

              <div className="button-row">
                <button
                  className="button primary"
                  disabled={loading === "otp-start"}
                  onClick={() => void handleOtpStart()}
                  type="button"
                >
                  {loading === "otp-start" ? "Starting..." : "Start OTP"}
                </button>
                <button
                  className="button secondary"
                  disabled={!challengeId}
                  onClick={() => {
                    setChallengeId(null);
                    setOtpCodeDraft("");
                  }}
                  type="button"
                >
                  Reset challenge
                </button>
              </div>

              <div className="hero-callout">
                <strong>Challenge id</strong>
                <div className="muted">{challengeId ?? "No active OTP challenge yet."}</div>
              </div>

              <label className="field">
                <span className="field-label">OTP code</span>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otpCodeDraft}
                  onChange={(event) => setOtpCodeDraft(event.target.value)}
                />
              </label>

              <div className="button-row">
                <button
                  className="button primary"
                  disabled={loading === "otp-verify" || !challengeId}
                  onClick={() => void handleOtpVerify()}
                  type="button"
                >
                  {loading === "otp-verify" ? "Verifying..." : "Verify OTP"}
                </button>
                <Link className="button ghost" href="/activate">
                  Step into activation
                </Link>
              </div>
            </div>
          ) : (
            <div className="stack">
              <label className="field">
                <span className="field-label">Email address</span>
                <input
                  className="input"
                  placeholder="user@example.com"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                />
                <span className="field-help">
                  This matches the contract for <code>/v1/auth/magic-link/start</code>.
                </span>
              </label>

              <div className="button-row">
                <button
                  className="button primary"
                  disabled={loading === "magic-start"}
                  onClick={() => void handleMagicStart()}
                  type="button"
                >
                  {loading === "magic-start" ? "Starting..." : "Start magic link"}
                </button>
                <button
                  className="button secondary"
                  disabled={!challengeId}
                  onClick={() => {
                    setChallengeId(null);
                    setMagicTokenDraft("");
                  }}
                  type="button"
                >
                  Reset challenge
                </button>
              </div>

              <div className="hero-callout">
                <strong>Challenge id</strong>
                <div className="muted">{challengeId ?? "No active magic link challenge yet."}</div>
              </div>

              <label className="field">
                <span className="field-label">Magic link token</span>
                <input
                  className="input"
                  placeholder="token_..."
                  value={magicTokenDraft}
                  onChange={(event) => setMagicTokenDraft(event.target.value)}
                />
                <span className="field-help">
                  Paste the one-time token from the emailed link.
                </span>
              </label>

              <div className="button-row">
                <button
                  className="button primary"
                  disabled={loading === "magic-verify" || !challengeId}
                  onClick={() => void handleMagicVerify()}
                  type="button"
                >
                  {loading === "magic-verify" ? "Verifying..." : "Verify magic link"}
                </button>
                <Link className="button ghost" href="/activate">
                  Step into activation
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="panel pad">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Anchor next step</h2>
              <p className="panel-subtitle">
                Reuse the verified session for existing-anchor TOTP step-up, or move into invite activation for first-time enrollment.
              </p>
            </div>
          </div>

          <div className="stack">
            <label className="field">
              <span className="field-label">Community id</span>
              <input
                className="input"
                placeholder="comm_..."
                value={communityIdDraft}
                onChange={(event) => setCommunityIdDraft(event.target.value)}
              />
              <span className="field-help">
                The chosen community is stored in sessionStorage for dashboard, queue, and anchor step-up loads.
              </span>
            </label>

            <div className="button-row">
              <button
                className="button primary"
                disabled={loading === "anchor-start" || !isVerified}
                onClick={() => void handleAnchorSessionStart()}
                type="button"
              >
                {loading === "anchor-start" ? "Starting..." : "Start anchor TOTP step-up"}
              </button>
              <Link className="button secondary" href="/activate">
                Continue to activation
              </Link>
            </div>

            <div className="hero-callout">
              <strong>Anchor challenge id</strong>
              <div className="muted">{anchorChallengeId ?? "No active anchor step-up challenge yet."}</div>
            </div>

            <label className="field">
              <span className="field-label">Anchor step-up code</span>
              <input
                className="input"
                inputMode="numeric"
                placeholder="123456"
                value={anchorTotpCodeDraft}
                onChange={(event) => setAnchorTotpCodeDraft(event.target.value)}
              />
              <span className="field-help">
                This verifies <code>/v1/auth/anchor/session/verify</code> for an already activated anchor.
              </span>
            </label>

            <div className="button-row">
              <button
                className="button primary"
                disabled={loading === "anchor-verify" || !anchorChallengeId}
                onClick={() => void handleAnchorSessionVerify()}
                type="button"
              >
                {loading === "anchor-verify" ? "Verifying..." : "Verify anchor TOTP"}
              </button>
              <button
                className="button ghost"
                disabled={!anchorChallengeId}
                onClick={() => {
                  setAnchorChallengeId(null);
                  setAnchorTotpCodeDraft("");
                }}
                type="button"
              >
                Reset anchor challenge
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel pad">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Dev fallback</h2>
            <p className="panel-subtitle">
              This keeps the shell bootstrappable when you need to paste a token pair directly.
            </p>
          </div>
        </div>

        <div className="stack">
          <label className="field">
            <span className="field-label">Access token</span>
            <textarea
              className="textarea"
              placeholder="eyJhbGciOi..."
              value={devAccessTokenDraft}
              onChange={(event) => setDevAccessTokenDraft(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Refresh token</span>
            <textarea
              className="textarea"
              placeholder="rt_xxx"
              value={devRefreshTokenDraft}
              onChange={(event) => setDevRefreshTokenDraft(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button className="button secondary" onClick={handleDevBootstrap} type="button">
              Load dev session
            </button>
            <button
              className="button ghost"
              onClick={() => {
                setDevAccessTokenDraft("");
                setDevRefreshTokenDraft("");
                setDevMessage(null);
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
