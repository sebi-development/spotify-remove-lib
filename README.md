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

| Category | Spotify endpoint |
|---|---|
| Playlists | `/me/playlists` |
| Liked Songs | `/me/tracks` |
| Saved Albums | `/me/albums` |
| Podcasts (Shows) | `/me/shows` |
| Saved Episodes | `/me/episodes` |
| Audiobooks | `/me/audiobooks` |
| Followed Artists | `/me/following?type=artist` |
