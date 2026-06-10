/* ============================================================
   Callan's Big World - Dropbox -> gallery sync
   Lists a Dropbox folder, sorts each photo/video into a
   category box, and writes photos.json + videos.json that the
   Photo/Video pages read. Runs daily via the GitHub Action.

   Node 18+ (built-in fetch).
   Env: DROPBOX_TOKEN (secret), DROPBOX_FOLDER (e.g. /Callan)
   ============================================================ */

const fs = require('fs');

const TOKEN = process.env.DROPBOX_TOKEN;
const FOLDER = process.env.DROPBOX_FOLDER || '';

function summary(md) {
  try { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n'); } catch (e) {}
  console.log(md.replace(/[#`*]/g, ''));
}
function fail(msg) {
  var oneLine = msg.replace(/[`*#]/g, '').replace(/\s+/g, ' ').trim();
  console.log('::error::Dropbox sync failed -- ' + oneLine);
  summary('\n## ❌ Dropbox sync failed\n\n' + msg + '\n');
  process.exit(1);
}

summary('## Dropbox sync');
summary('- DROPBOX_TOKEN present: ' + (TOKEN ? '✅ yes (length ' + TOKEN.length + ')' : '❌ **NO — missing on this repo**'));
summary('- DROPBOX_FOLDER: `' + (FOLDER || '(root)') + '`');

if (!TOKEN) {
  fail('**`DROPBOX_TOKEN` is missing on this repository.**\n\n' +
       'Fix: on the **callans-big-world-site** repo → Settings → Secrets and variables → Actions → **Secrets** tab → New repository secret → name it exactly `DROPBOX_TOKEN`, paste a fresh Dropbox token → Add secret. Then re-run.');
}

const IMG = /\.(jpe?g|png|gif|webp|heic|bmp)$/i;
const VID = /\.(mp4|mov|m4v|webm|ogg|avi|mkv)$/i;

function categorize(name, pathLower) {
  const s = (pathLower + ' ' + name).toLowerCase();
  if (/\b(ball|balls|soccer|basket|football)\b/.test(s)) return 'balls';
  if (/\b(truck|trucks|fire ?truck|dump|garbage|semi|rig)\b/.test(s)) return 'trucks';
  if (/\b(excavat|digger|crane|bulldoz|tractor|loader|machine|construction|forklift|backhoe)\b/.test(s)) return 'machines';
  return 'more';
}

async function dbx(endpoint, body) {
  const res = await fetch('https://api.dropboxapi.com/2/' + endpoint, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) { const e = new Error(endpoint + ' -> ' + res.status + ' ' + text); e.status = res.status; e.body = text; throw e; }
  return JSON.parse(text);
}

function rawUrl(url) {
  return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&](dl|raw)=\d/g, '') + (url.includes('?') ? '&raw=1' : '?raw=1');
}
async function sharedLink(pathLower) {
  try { const r = await dbx('sharing/create_shared_link_with_settings', { path: pathLower }); return rawUrl(r.url); }
  catch (e) {
    const r = await dbx('sharing/list_shared_links', { path: pathLower, direct_only: true });
    if (r.links && r.links[0]) return rawUrl(r.links[0].url);
    throw e;
  }
}
async function listFolder(path) {
  let entries = [];
  let r = await dbx('files/list_folder', { path: path, recursive: true });
  entries = entries.concat(r.entries);
  while (r.has_more) { r = await dbx('files/list_folder/continue', { cursor: r.cursor }); entries = entries.concat(r.entries); }
  return entries.filter(e => e['.tag'] === 'file');
}

(async function main() {
  const files = await listFolder(FOLDER);
  const photos = [], videos = [];
  for (const f of files) {
    const isImg = IMG.test(f.name), isVid = VID.test(f.name);
    if (!isImg && !isVid) continue;
    let url;
    try { url = await sharedLink(f.path_lower); } catch (e) { console.warn('skip ' + f.name + ': ' + e.message); continue; }
    const item = { url, category: categorize(f.name, f.path_lower), caption: f.name.replace(/\.[^.]+$/, '') };
    (isImg ? photos : videos).push(item);
  }
  fs.writeFileSync('photos.json', JSON.stringify(photos, null, 2));
  fs.writeFileSync('videos.json', JSON.stringify(videos, null, 2));
  summary('\n## ✅ Sync complete\n\nWrote **' + photos.length + ' photos** and **' + videos.length + ' videos** from `' + (FOLDER || '(root)') + '`.');
  if (photos.length + videos.length === 0) {
    summary('\n> ⚠️ Found 0 photos/videos. Make sure your `' + (FOLDER || 'root') + '` Dropbox folder actually contains image/video files.');
  }
})().catch(err => {
  const m = String((err && err.message) || err);
  let hint;
  if (/-> 401/.test(m) || /invalid_access_token|expired_access_token/i.test(m)) {
    hint = '**Your Dropbox token is invalid or expired.** Dropbox tokens expire after ~4 hours. Generate a fresh one (Dropbox app → Settings → Generated access token → **Generate**), then update the `DROPBOX_TOKEN` secret and re-run within a few minutes.';
  } else if (/missing_scope/i.test(m)) {
    hint = '**Your Dropbox app is missing permissions.** In the Dropbox app → **Permissions**, enable `files.metadata.read`, `files.content.read`, `sharing.read`, `sharing.write` → Submit. Then **generate a NEW token** (changing permissions requires a new token), update the `DROPBOX_TOKEN` secret, and re-run.';
  } else if (/not_found/i.test(m)) {
    hint = '**Dropbox could not find the folder** `' + FOLDER + '`. Check the `DROPBOX_FOLDER` variable matches your folder exactly — case-sensitive, starts with `/`. For a top-level folder named "Callan", use `/Callan`.';
  } else {
    hint = 'Unexpected error talking to Dropbox.';
  }
  fail(hint + '\n\nTechnical detail:\n```\n' + m + '\n```');
});
