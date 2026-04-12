# Anchor Admin (M5)

This package contains the M5 Anchor Admin shell.

Current shell scope:

- App Router pages for `/`, `/login`, `/activate`, `/review`, `/announcements`, and `/rules`
- Client-side auth context with in-memory access token and `sessionStorage` refresh token
- 401-triggered refresh attempts and 4 hour idle timeout logout
- Review queue tabs for posts and reports
- Announcement CRUD UI
- Community rules editor
- Six-card dashboard overview

The package is intentionally UI-first. It expects the API gateway contracts for anchor activation, step-up login, moderation, announcements, and rules to exist in the backend.
