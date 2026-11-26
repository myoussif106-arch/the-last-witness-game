// In-game updater. Releases are published (tools/release.mjs) to a public GitHub repository:
//   manifest.json            { version, date, notes, files: { "rel/path": { sha256, size } } }
//   app/<rel/path>           the game files of that version
// Only files whose hash changed are downloaded. The new version is assembled in
// %APPDATA%/<game>/update/staging and then renamed to update/app-<version>; the launcher
// (main.js) picks the newest complete version on the next start.
const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = global.LW_ROOT || __dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8').replace(/^﻿/, ''));
const REPO = pkg.updateRepo;           // e.g. "user/the-last-witness-game"
const BRANCH = pkg.updateBranch || 'main';
// Files are read from an exact commit (immutable URLs), so the raw CDN's ~5 min branch cache can never serve stale bytes.
let REF = BRANCH;
const RAW = (p) => `https://raw.githubusercontent.com/${REPO}/${REF}/${p.split('/').map(encodeURIComponent).join('/')}`;
async function resolveRef() {
  try {
    const r = await net.fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, { headers: { Accept: 'application/vnd.github.sha', 'User-Agent': 'the-last-witness-updater' }, cache: 'no-store' });
    if (r.ok) { const s = (await r.text()).trim(); if (/^[0-9a-f]{40}$/.test(s)) REF = s; }
  } catch { /* fall back to the branch name */ }
}

const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function getJSON(url) {
  const r = await net.fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function getBuffer(url) {
  const r = await net.fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return Buffer.from(await r.arrayBuffer());
}

// true when the installed copy of `p` already has the expected content (checked by hash, not trusted from a list)
const hashCache = new Map();
function haveFile(p, f) {
  const abs = path.join(ROOT, p);
  try {
    const st = fs.statSync(abs);
    if (st.size !== f.size) return false;
    if (!hashCache.has(abs)) hashCache.set(abs, sha(fs.readFileSync(abs)));
    return hashCache.get(abs) === f.sha256;
  } catch { return false; }
}

let remote = null;

async function check() {
  if (!REPO) return { available: false, current: pkg.version, reason: 'no-repo' };
  await resolveRef();
  remote = await getJSON(RAW('manifest.json'));
  const available = cmp(remote.version, pkg.version) > 0;
  let size = 0;
  if (available) for (const [p, f] of Object.entries(remote.files)) if (!haveFile(p, f)) size += f.size;
  return { available, current: pkg.version, version: remote.version, notes: remote.notes || '', size };
}

async function download(onProgress) {
  if (!remote) await check();
  const updDir = path.join(app.getPath('userData'), 'update');
  const staging = path.join(updDir, 'staging');
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const entries = Object.entries(remote.files);
  const todo = entries.filter(([p, f]) => !haveFile(p, f));
  const total = todo.reduce((s, [, f]) => s + f.size, 0);
  let done = 0;
  // unchanged files: copy from the current version
  const todoSet = new Set(todo.map(([p]) => p));
  for (const [p] of entries) {
    if (todoSet.has(p)) continue;
    const dst = path.join(staging, p);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(ROOT, p), dst);
  }
  // changed files: download in parallel (4 at a time) and verify
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const [p, f] = todo[i++];
      let buf;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { buf = await getBuffer(RAW('app/' + p)); if (sha(buf) !== f.sha256) throw new Error('hash mismatch ' + p); break; }
        catch (e) { if (attempt === 2) throw e; await new Promise(r => setTimeout(r, 1500)); }
      }
      const dst = path.join(staging, p);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, buf);
      done += f.size;
      onProgress && onProgress(total ? done / total : 1);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(remote));
  fs.writeFileSync(path.join(staging, '.complete'), remote.version);
  const target = path.join(updDir, 'app-' + remote.version);
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(staging, target);
  return { version: remote.version };
}

module.exports = { check, download, enabled: () => app.isPackaged && !!REPO, version: pkg.version };
