import { Storage } from '../core/storage.js';
import { DEFAULT_SETTINGS } from '../core/settings.js';
import { CASES } from '../cases/index.js';

export function newCaseState() {
  return {
    started: Date.now(), elapsed: 0,
    evidence: {}, statements: {}, deductions: {}, flags: {},
    topicsDone: {}, moods: {}, metNpcs: {},
    notes: '', log: [],
    board: { items: {}, links: [] },
    player: null, doors: {},
    accusations: [],
    seenHints: {},
  };
}

// Global progress + the live state of the case being played.
export class GameState {
  constructor() {
    this.data = { version: 1, settings: { ...DEFAULT_SETTINGS }, cases: {}, current: null, lastPlayed: null };
    this.listeners = new Set();
    this._saveTimer = null;
  }

  async load() {
    const d = await Storage.load();
    // phones start on a lighter graphics preset (can be raised in the settings)
    if (!d && document.documentElement.classList.contains('touch')) this.data.settings.quality = 'medium';
    if (d && d.version === 1) {
      this.data = d;
      this.data.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
    }
    for (const [i, c] of CASES.entries()) {
      if (!this.data.cases[c.id]) this.data.cases[c.id] = { unlocked: i === 0, solved: false, bestScore: 0, bestRating: null, attempts: 0, state: null };
    }
    return this.data;
  }

  get settings() { return this.data.settings; }
  caseProgress(id) { return this.data.cases[id]; }
  get hasContinue() { const c = this.data.current && this.data.cases[this.data.current]; return !!(c && c.state); }

  startCase(id, fresh = false) {
    const cp = this.data.cases[id];
    if (fresh || !cp.state) cp.state = newCaseState();
    this.data.current = id; this.data.lastPlayed = Date.now();
    this.caseId = id; this.cs = cp.state;
    this.saveSoon(0);
    return this.cs;
  }

  // ----- investigation helpers -----
  has(id) {
    const s = this.cs; if (!s) return false;
    return !!(s.evidence[id] || s.statements[id] || s.deductions[id]);
  }
  flag(name) { return !!(this.cs && this.cs.flags[name]); }
  setFlag(name, v = true) { this.cs.flags[name] = v; this.emit('flag', name); this.saveSoon(); }

  addEvidence(id) { if (this.cs.evidence[id]) return false; this.cs.evidence[id] = { t: Date.now(), details: [] }; this.emit('evidence', id); this.saveSoon(0); return true; }
  revealDetail(evId, detailId) { const e = this.cs.evidence[evId]; if (!e || e.details.includes(detailId)) return false; e.details.push(detailId); this.emit('detail', evId); this.saveSoon(); return true; }
  addStatement(id) { if (this.cs.statements[id]) return false; this.cs.statements[id] = { t: Date.now() }; this.emit('statement', id); this.saveSoon(0); return true; }
  addDeduction(id) { if (this.cs.deductions[id]) return false; this.cs.deductions[id] = { t: Date.now() }; this.emit('deduction', id); this.saveSoon(0); return true; }
  topicDone(npc, topic) { return !!(this.cs.topicsDone[npc] && this.cs.topicsDone[npc].includes(topic)); }
  markTopic(npc, topic) { (this.cs.topicsDone[npc] ||= []); if (!this.cs.topicsDone[npc].includes(topic)) this.cs.topicsDone[npc].push(topic); this.saveSoon(); }
  log(text) { this.cs.log.push({ t: Date.now(), text }); this.emit('log', text); this.saveSoon(); }

  recordAccusation(result) {
    const cp = this.data.cases[this.caseId];
    this.cs.accusations.push(result);
    cp.attempts++;
    if (result.score > cp.bestScore) { cp.bestScore = result.score; cp.bestRating = result.rating; }
    if (result.passed) {
      cp.solved = true;
      cp.solvedAt = Date.now();
      cp.summary = result.summary;
      const idx = CASES.findIndex(c => c.id === this.caseId);
      const next = CASES[idx + 1];
      if (next) this.data.cases[next.id].unlocked = true;
    }
    this.saveSoon(0);
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, payload) { for (const l of this.listeners) l(type, payload); }

  saveSoon(delay = 800) {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveNow(), delay);
  }
  async saveNow() {
    clearTimeout(this._saveTimer);
    const ok = await Storage.save(this.data);
    this.emit('saved', ok);
    return ok;
  }
  resetAll() {
    const settings = this.data.settings;
    this.data = { version: 1, settings, cases: {}, current: null, lastPlayed: null };
    for (const [i, c] of CASES.entries()) this.data.cases[c.id] = { unlocked: i === 0, solved: false, bestScore: 0, bestRating: null, attempts: 0, state: null };
    return this.saveNow();
  }
}

export const game = new GameState();
