"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/review", label: "Review" },
  { href: "/announcements", label: "Announcements" },
  { href: "/rules", label: "Rules" },
  { href: "/activate", label: "Activate" },
  { href: "/login", label: "Login" },
];

type AdminShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AdminShell({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const {
    isAuthenticated,
    isAnchor,
    communityIds,
    selectedCommunityId,
    selectCommunity,
    signOut,
    accessToken,
    sessionLabel,
    status,
  } = useAuth();
  const [communityDraft, setCommunityDraft] = useState(selectedCommunityId ?? "");

  useEffect(() => {
    setCommunityDraft(selectedCommunityId ?? "");
  }, [selectedCommunityId]);

  const statusBadge = useMemo(() => {
    if (status === "hydrating") {
      return "Restoring session";
    }

    if (!isAuthenticated) {
      return "No session";
    }

    if (!isAnchor) {
      return "Verified only";
    }

    return "Anchor active";
  }, [isAnchor, isAuthenticated, status]);

  const handleCommunityApply = () => {
    selectCommunity(communityDraft.trim());
  };

  // A1 P1-7 — "Clear all devices" revokes every refresh-token family
  // belonging to this user on the gateway, forcing re-auth on every
  // browser the anchor has logged in from. Used if the anchor suspects
  // their laptop was stolen / shared session persists on a kiosk.
  const handleSignOutAllDevices = async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "This will sign you out on every browser you have used. Continue?",
      );
      if (!confirmed) {
        return;
      }
    }
    // Best-effort POST to /v1/auth/logout with revoke_all_devices=true
    // before the local signOut clears tokens. If the network call fails
    // we still clear locally so the user is never stranded.
    try {
      if (accessToken) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/v1/auth/logout`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ revoke_all_devices: true }),
            cache: "no-store",
          },
        );
      }
    } catch {
      // best-effort
    }
    signOut({ redirectToLogin: true, reason: "manual_all_devices" });
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <div className="brand-title">WeaveNYC</div>
            <div className="brand-subtitle">Anchor admin console</div>
          </div>
        </div>

        <nav className="nav-list" aria-label="Anchor admin navigation">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                data-active={active ? "true" : "false"}
              >
                <span className="nav-dot" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-label">Session</div>
          <div className="sidebar-value">{sessionLabel}</div>
          <div className="sidebar-note">{statusBadge}</div>
        </div>
      </aside>

      <div className="admin-content">
        <header className="topbar">
          <div className="topbar-copy">
            {eyebrow ? <div className="kicker">{eyebrow}</div> : null}
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>

          <div className="topbar-controls">
            <div className="community-control">
              <label className="sr-only" htmlFor="community-id">
                Current community
              </label>
              <input
                id="community-id"
                className="input"
                placeholder={
                  communityIds.length > 0
                    ? "Select or type community id"
                    : "community id"
                }
                value={communityDraft}
                onChange={(event) => setCommunityDraft(event.target.value)}
              />
              <div className="button-row">
                <button className="button secondary" onClick={handleCommunityApply} type="button">
                  Use community
                </button>
                <button
                  className="button ghost"
                  onClick={() => signOut({ redirectToLogin: true, reason: "manual" })}
                  type="button"
                >
                  Sign out
                </button>
                <button
                  className="button ghost"
                  onClick={() => {
                    void handleSignOutAllDevices();
                  }}
                  type="button"
                  data-testid="admin-shell-sign-out-all-devices"
                >
                  Clear all devices
                </button>
              </div>
            </div>

            {actions ? <div className="topbar-actions">{actions}</div> : null}
          </div>
        </header>

        <main className="main-stack">{children}</main>
      </div>
    </div>
  );
}
