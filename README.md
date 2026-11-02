# Spotify Library Cleaner

A modern full-stack web application to safely inspect, preview, and wipe categories from your Spotify library — playlists, liked songs, saved albums, podcasts, saved episodes, audiobooks, and followed artists.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, **Vite**, **Express 5**, and **WebSockets**.

---

## Features

- **Granular Category Selection**: Choose exactly which categories to clean or wipe.
- **Live Library Inspection**: Automatically counts and displays current item counts per category upon logging in.
- **Safe Dry Run Mode**: Default simulation mode lets you preview removals without deleting anything.
- **Confirmation Dialog**: Real runs require explicit confirmation detailing the target account and item counts before performing irreversible actions.
- **Real-Time Progress**: Live WebSocket updates showing per-category progress bars, status indicators, and completion summaries.
- **Safety Cancellation**: Stop an in-progress job at any time via the UI, or automatically cancel if all browser tabs are closed.
- **Library Backup**: Stream a full JSON backup of selected categories prior to cleaning.

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a Spotify App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Create an app (or select an existing one).
3. In your app settings, add the following **Redirect URI**:
   ```
   http://127.0.0.1:8888/callback
   ```
   *(Note: Spotify requires `http://127.0.0.1:...` rather than `localhost` for strict URI matching).*

### 3. Create `.env` in the project root

Copy `.env.example` or create a `.env` file:

```env
CLIENT_ID=your_spotify_client_id
REDIRECT_URI=http://127.0.0.1:8888/callback
PORT=8888
```

*(Note: Uses OAuth 2.0 PKCE with SHA-256 code challenge/verifier; no `CLIENT_SECRET` is required).*

---

## Running the Application

### Development Mode

Runs the Express server with file watching (`tsx watch`) and Vite middleware for instant hot module reloading (HMR):

```bash
pnpm dev
```

Open **http://127.0.0.1:8888** in your browser.

### Production Build & Run

Build the React frontend and run the production server:

```bash
pnpm build
pnpm start
```

### Testing & Quality Checks

```bash
pnpm test        # Run unit and integration tests with Vitest
pnpm typecheck   # Typecheck backend and frontend TypeScript
```

---

## Usage

1. Open **http://127.0.0.1:8888** in your browser.
2. Click **Login with Spotify** and authorize the app with your account.
3. Review your library overview showing current counts for each category.
4. Select the categories you want to target using the checkboxes.
5. Choose your run mode:
   - **Dry Run (Preview)**: Keep **Dry run** checked (enabled by default) and click **Preview removal** to simulate deletion safely.
   - **Real Run**: Uncheck **Dry run** and click **Remove from my library**. A confirmation modal will appear with your account name and total item breakdown. Confirm to proceed.
6. Watch real-time progress bars update live. You can click **Cancel** at any time to abort remaining deletions.

---

## Library Backup (Optional)

You can download a structured JSON backup of selected categories before cleaning. While logged in with your active session:

```bash
curl -O -J "http://127.0.0.1:8888/api/library/backup?categories=tracks,albums,playlists" \
  --cookie "sid=YOUR_SESSION_ID"
```

This streams a `spotify-backup-YYYY-MM-DD.json` file containing Spotify URIs, item names, and creator details.

---

## What Gets Deleted

| Category | Spotify endpoint | Notes |
|---|---|---|
| Playlists | `/me/playlists` | User-created and followed 3rd-party playlists (see limitation below) |
| Liked Songs | `/me/tracks` | All liked tracks |
| Saved Albums | `/me/albums` | All saved albums |
| Podcasts (Shows) | `/me/shows` | All followed podcasts |
| Saved Episodes | `/me/episodes` | All saved podcast episodes |
| Audiobooks | `/me/audiobooks` | All saved audiobooks |
| Followed Artists | `/me/following?type=artist` | All followed artists |

---

## Known Limitation: Spotify-Owned & Algorithmic Playlists

On **November 27, 2024**, Spotify updated its Web API policy, restricting third-party applications (without legacy extended-mode approval) from accessing or modifying Spotify-owned algorithmic or editorial playlists.

As a result:
- **Deleted:** Playlists you created yourself, and playlists created by other regular Spotify users that you followed.
- **Not deleted (API limit):** Spotify-owned playlists such as *Discover Weekly*, *Release Radar*, *Daily Mixes*, *Daylist*, or editorial playlists like *Today's Top Hits*.

### Quick Workaround for Spotify Playlists
To remove remaining Spotify-owned playlists:
1. Open the **Spotify Desktop App** (macOS or Windows).
2. Go to **Your Library** &rarr; filter by **Playlists**.
3. Hold <kbd>Shift</kbd> (or <kbd>Cmd</kbd> / <kbd>Ctrl</kbd>) to multi-select the playlists.
4. Right-click and choose **Remove from Your Library**. They will all be removed in seconds.
