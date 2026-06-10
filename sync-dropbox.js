/* ============================================================
   Callan's Big World — Dropbox -> gallery sync
   Lists a Dropbox folder, sorts each photo/video into a
   category box, and writes photos.json + videos.json that the
   Photo/Video pages read. Run this once a day (see the GitHub
   Action in .github/workflows/sync-dropbox.yml).

   Requires Node 18+ (built-in fetch).
   Environment variables:
     DROPBOX_TOKEN   = your Dropbox access token (keep secret!)
     DROPBOX_FOLDER  = folder path, e.g. "/Callan/Website-Public"
   ============================================================ */

const fs = require('fs');

const TOKEN = process.env.DROPBOX_TOKEN;
const FOLDER = process.env.DROPBOX_FOLDER || '';
if (!TOKEN) { console.error('Missing DROPBOX_TOKEN'); process.exit(1); }

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
  if (!res.ok) throw new Error(endpoint + ' -> ' + res.status + ' ' + (await res.text()));
  return res.json();
}

// Turn a Dropbox shared link into a direct, embeddable media URL
function rawUrl(url) {
  return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=\d/, '').replace(/[?&]raw=\d/, '') + (url.includes('?') ? '&raw=1' : '?raw=1');
}

async function sharedLink(pathLower) {
  // try to create; if it already exists, fetch the existing one
  try {
    const r = await dbx('sharing/create_shared_link_with_settings', { path: pathLower });
    return rawUrl(r.url);
  } catch (e) {
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
    try { url = await sharedLink(f.path_lower); } catch (e) { console.warn('skip', f.name, e.message); continue; }
    const item = { url, category: categorize(f.name, f.path_lower), caption: f.name.replace(/\.[^.]+$/, '') };
    (isImg ? photos : videos).push(item);
  }
  fs.writeFileSync('photos.json', JSON.stringify(photos, null, 2));
  fs.writeFileSync('videos.json', JSON.stringify(videos, null, 2));
  console.log('Wrote ' + photos.length + ' photos and ' + videos.length + ' videos.');
})().catch(err => { console.error(err); process.exit(1); });
