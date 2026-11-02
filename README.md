# Spotify Library Cleaner

Wipes your entire Spotify library in one go — saved tracks, albums, playlists, podcasts, episodes, audiobooks, and followed artists.

## Setup

**1. Install dependencies**
```bash
pnpm install
```

**2. Create a Spotify app**

Go to [developer.spotify.com/dashboard], create an app, and add the following Redirect URI in its settings:
```
http://127.0.0.1:8888/callback
```

**3. Create `.env` in the project root**
```env
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
REDIRECT_URI=http://127.0.0.1:8888/callback
```

## Run

```bash
pnpm start
```

Or with file-watching during development:
```bash
pnpm dev
```

Server starts at **http://127.0.0.1:8888**

## Usage

1. Open **http://127.0.0.1:8888** in your browser
2. Click **Login with Spotify** and authorize the app
3. After login, click **Wipe my library**
4. Confirm the browser dialog
5. Wait — progress logs to the server console, result shows on the page when done

## Via curl (no browser)

```bash
# Step 1 — get a token another way, or grab sid cookie after logging in via browser

# Step 2 — trigger cleanup
curl -X POST "http://127.0.0.1:8888/cleanup?confirm=DELETE" \
  --cookie "sid=YOUR_SESSION_ID"
```

## What gets deleted

| Category | Spotify endpoint | Notes |
|---|---|---|
| Playlists | `/me/playlists` | User-created and followed 3rd-party playlists (see limitation below) |
| Liked Songs | `/me/tracks` | All liked tracks |
| Saved Albums | `/me/albums` | All saved albums |
| Podcasts (Shows) | `/me/shows` | All followed podcasts |
| Saved Episodes | `/me/episodes` | All saved podcast episodes |
| Audiobooks | `/me/audiobooks` | All saved audiobooks |
| Followed Artists | `/me/following?type=artist` | All followed artists |

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
