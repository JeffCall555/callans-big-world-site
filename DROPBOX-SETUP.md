# 🚚 Auto-fill Callan's galleries from Dropbox (once a day)

The Photo & Video pages will automatically show whatever is in a Dropbox folder,
sorted into the **Balls / Trucks / Big Machines / More Fun** boxes — refreshed
**once a day**. Two pieces have to be set up by you (they can't be automated for
you, and they involve a private account + a secret token).

> ⚠️ **Privacy first:** anything in the synced folder becomes **publicly visible
> on the website**. Do **not** point this at your whole "PERSONAL PHOTOS" folder.
> Make a *new* folder just for the site, e.g. `/Callan/Website-Public`, and only
> put share-safe photos/videos in there. Tip: name sub-folders `Balls`, `Trucks`,
> `Machines` (or include those words in file names) and they'll auto-sort into the
> right boxes.

## What's already built for you
- `photos.html` / `videos.html` — read `photos.json` / `videos.json` and drop each
  item into its category box.
- `sync-dropbox.js` — lists the Dropbox folder, makes share links, categorizes, and
  writes `photos.json` + `videos.json`.
- `.github/workflows/sync-dropbox.yml` — runs the sync **every day** and publishes it.

## Step 1 — Make a Dropbox access token (≈2 min)
1. Go to **https://www.dropbox.com/developers/apps** → **Create app**.
2. Choose **Scoped access** → **Full Dropbox** (or App folder) → name it `callan-site`.
3. On the app's **Permissions** tab, enable: `files.metadata.read`, `files.content.read`,
   `sharing.read`, `sharing.write`. **Submit**.
4. On the **Settings** tab → **Generated access token** → **Generate**. Copy it.
   (Keep it secret — anyone with it can read your Dropbox.)

## Step 2 — Host it on GitHub Pages (free, runs the daily job)
1. Create a free GitHub account + a new repository (e.g. `callans-big-world`).
2. Upload this whole folder to the repo.
3. Repo **Settings → Pages** → Source: `Deploy from a branch` → `main` / root. Save.
   Your site is now live at `https://<you>.github.io/callans-big-world/`.
4. Repo **Settings → Secrets and variables → Actions**:
   - **New repository secret** → name `DROPBOX_TOKEN`, value = the token from Step 1.
   - **Variables** tab → **New variable** → name `DROPBOX_FOLDER`, value = your folder
     path, e.g. `/Callan/Website-Public`.
5. **Actions** tab → run **"Sync Callan's Dropbox gallery (daily)"** once to test
   (the ▶ "Run workflow" button). After that it runs automatically every day.

That's it — add photos/videos to the Dropbox folder, and within a day they appear in
the right boxes on the site. 🎉

## Run it locally (optional, to test)
```bash
# Node 18+ required
set DROPBOX_TOKEN=your-token-here        # Windows PowerShell: $env:DROPBOX_TOKEN="..."
set DROPBOX_FOLDER=/Callan/Website-Public
node sync-dropbox.js                      # writes photos.json + videos.json
```

## Notes & limits
- **It needs hosting + the token** — it can't run from a file double-clicked on your
  desktop, and it can't read a private `dropbox.com/home/...` link.
- Dropbox direct links can be rate-limited on very high-traffic sites; fine for family use.
- Don't like GitHub? Any host + a daily scheduler (Netlify scheduled function, a tiny
  server with cron, etc.) works — the script is the same.
