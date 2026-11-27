// Anonymous play statistics, sent to the owner's private database (Supabase).
// The database only lets the game INSERT rows; nobody can read them with the key that ships
// in the game. Fully anonymous by design: there is NO player or device identifier — only
// event counts with platform/OS/device model, game version and case results.
import { TELEMETRY } from './telemetry-config.js';
import { isNativeMobile } from './platform.js';

const QKEY = 'lw-telemetry-queue';
let game = null, version = '?', device = null;

const enabled = () => !!(TELEMETRY.url && TELEMETRY.key && game);

// automated tests tag their events so they can be told apart (and deleted)
const isTest = new URLSearchParams(location.search).has('statstest');
function platform() { return isTest ? 'test' : isNativeMobile ? 'android' : window.native ? 'windows' : 'web'; }

async function readDevice() {
  if (device) return device;
  const d = { platform: platform(), os: '', model: '' };
  try {
    const ua = navigator.userAgentData;
    if (ua && ua.getHighEntropyValues) {
      const v = await ua.getHighEntropyValues(['platformVersion', 'model']);
      d.os = `${ua.platform || ''} ${v.platformVersion || ''}`.trim();
      d.model = v.model || '';
    }
  } catch {}
  if (!d.os) { const m = navigator.userAgent.match(/(Android [\d.]+|Windows NT [\d.]+)/); d.os = m ? m[1] : ''; }
  // desktop browsers never report a model: the Windows app reads the PC maker/model itself
  if (!d.model && window.native && window.native.deviceModel) { try { d.model = (await window.native.deviceModel()) || ''; } catch {} }
  return (device = d);
}

function queue() { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } }
function saveQueue(q) { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-200))); } catch {} }

async function flush() {
  if (!enabled()) return;
  const q = queue(); if (!q.length) return;
  try {
    const r = await fetch(`${TELEMETRY.url}/rest/v1/events`, {
      method: 'POST',
      headers: { apikey: TELEMETRY.key, Authorization: `Bearer ${TELEMETRY.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(q),
    });
    if (r.ok) saveQueue([]);
  } catch { /* offline: try again later */ }
}

export const Telemetry = {
  async init(g, ver) {
    game = g; version = ver || '?';
    await readDevice();
    if (enabled() && !game.data.installCounted) { game.data.installCounted = true; game.saveSoon(); this.track('first_launch'); }
    flush();
  },
  async track(event, caseId = null, data = null) {
    if (!enabled()) return;
    const d = await readDevice();
    const q = queue();
    q.push({ event, platform: d.platform, os: d.os.slice(0, 60), model: d.model.slice(0, 80), version, case_id: caseId, data });
    saveQueue(q);
    flush();
  },
  // like / dislike from the main menu; `prev` is set when a player changes their vote
  vote(v, prev = null) { return this.track('feedback', null, prev ? { vote: v, prev } : { vote: v }); },
  get configured() { return !!(TELEMETRY.url && TELEMETRY.key); },
};
