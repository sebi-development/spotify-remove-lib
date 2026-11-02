# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-02

### Added
- **Modern Full-Stack Architecture**: React 19 single-page application powered by Vite, Tailwind CSS, Express 5, and WebSockets.
- **Granular Category Selection**: Individual category selection for Liked Songs, Saved Albums, Playlists, Podcasts, Saved Episodes, Audiobooks, and Followed Artists.
- **Live Library Overview**: Dynamic inspection and counter display for each category before performing any action.
- **Safe Dry Run Mode**: Default preview mode simulating removals without sending write requests to Spotify.
- **Confirmation Modal**: Destructive wipe protection requiring explicit confirmation with target account details and item breakdown.
- **Real-Time WebSocket Progress**: Live progress bars and status indicators streaming job progress (`category_started`, `progress`, `category_done`).
- **Graceful Job Cancellation**: Real-time cancellation support via UI or automatic cancellation upon browser tab closure.
- **Streaming JSON Backup**: Export endpoint (`/api/library/backup`) streaming a snapshot of selected library items.
- **OAuth 2.0 PKCE**: Secure authorization code flow using SHA-256 code challenge and verifier without exposing client secrets.
- **Test Suite**: 95 unit and integration tests using Vitest and in-memory Spotify API mocking.
