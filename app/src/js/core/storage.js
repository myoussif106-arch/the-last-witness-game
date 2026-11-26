// Persistent save storage: a JSON file in the user's AppData when running in the
// desktop app (Electron), with a localStorage fallback for browser testing.
const KEY = 'last-witness-save-v1';

export const Storage = {
  async load() {
    try {
      if (window.native) return (await window.native.readSave()) || null;
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { console.warn('save load failed', e); return null; }
  },
  async save(data) {
    try {
      if (window.native) return await window.native.writeSave(data);
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { console.warn('save failed', e); return false; }
  },
};
