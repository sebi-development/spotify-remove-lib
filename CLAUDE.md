# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small Express 5 + TypeScript app that logs a user into Spotify (OAuth authorization-code flow) and then wipes their entire library: playlists, liked songs, saved albums, shows, episodes, audiobooks, and followed artists. **It performs irreversible, destructive actions against a real Spotify account** — never run `/cleanup` (or click "Wipe my library") against a real account while testing.

## Commands

Package manager is **pnpm** (ESM project, `"type": "module"`).

- `pnpm install` — install deps
- `pnpm start` — run the server once (`tsx server/server.ts`), listens on http://127.0.0.1:8888
- `pnpm dev` — same, with `tsx watch`
- `pnpm exec tsc --noEmit` — typecheck (there is no build step; `tsx` runs the `.ts` files directly)

There is no test runner and no linter configured.

Config comes from a `.env` in the project root (loaded via `dotenv/config`): `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI` (must be `http://127.0.0.1:8888/callback` and registered in the Spotify dashboard; `localhost` won't match). The `.env` holds real credentials — don't print or commit it (`.gitignore` is currently empty and this directory is not a git repo).

## Architecture

Three files, no client build:

- `server/server.ts` — Express app. Routes: `/login` (redirects to Spotify with a random `state` cookie), `/callback` (validates state, exchanges the code for an access token server-side, stores it in an in-memory `sessions` Map keyed by a random `sid` cookie), `/verifyme` (proxies Spotify `/me` for the UI), `POST /cleanup` (calls `runCleanup`). Also serves `public/` statically. Comments in the file deliberately separate "front channel" (browser-visible) from "back channel" (server-to-Spotify, where `client_secret` is allowed) — preserve that separation.
- `server/cleaner.ts` — Spotify logic, independent of Express. Takes the access token as an argument (no globals) and reports progress via an `onProgress` callback. Everything is deleted through the single unified `DELETE /me/library?uris=...` endpoint (max 40 URIs per call), including playlists and followed artists. `cleanOffsetPaged` re-fetches `offset=0` repeatedly because items shift after each delete; `cleanFollowedArtists` does the same with the cursor-style `/me/following` endpoint. `api()` retries on 429 (honoring `Retry-After`) and 5xx. `runCleanup` runs categories sequentially.
- `public/index.html` — single static page with inline JS: checks `/verifyme`, shows login or wipe button, POSTs to `/cleanup?confirm=DELETE`. Progress is only logged on the server console; the page just waits for the final summary.

Session state (`sessions`) is in-memory only: restarting the server logs everyone out. Only the access token is kept — no refresh token handling, so sessions die when the token expires (~1h).

## Things to be aware of

- Local imports use explicit `.ts` extensions (`./cleaner.ts`); keep that when adding modules (tsconfig is `module: nodenext`, `verbatimModuleSyntax`, `isolatedModules`, so use `import type` for type-only imports).
- `/cleanup` reads its confirmation from the query string (`?confirm=DELETE`), not the body; no body parser is installed.
- **Spotify API Limitation (Nov 27, 2024)**: Spotify-owned editorial and algorithmic playlists (`Discover Weekly`, `Daylist`, `Daily Mix`, etc.) return 404 or are omitted by the Web API for standard developer apps. They cannot be unfollowed via the third-party Web API; user guidance is provided in the UI for quick manual removal via the Spotify desktop app.
