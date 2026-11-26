// Launcher. In the shipped game it loads the newest downloaded update (if any) from the
// user's AppData, otherwise the copy bundled with the game. Keep this file tiny and stable:
// it is the only part of the app that updates cannot replace.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const readVersion = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8').replace(/^﻿/, '')).version; } catch { return null; } };
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

let root = __dirname;
if (app.isPackaged) {
  try {
    const updDir = path.join(app.getPath('userData'), 'update');
    let best = { dir: __dirname, ver: readVersion(__dirname) || '0.0.0' };
    for (const name of fs.existsSync(updDir) ? fs.readdirSync(updDir) : []) {
      const dir = path.join(updDir, name);
      const v = readVersion(dir);
      if (v && name.startsWith('app-') && fs.existsSync(path.join(dir, 'app-main.js')) && fs.existsSync(path.join(dir, '.complete')) && cmp(v, best.ver) > 0) best = { dir, ver: v };
    }
    root = best.dir;
    // remove older downloaded versions that are no longer used
    for (const name of fs.existsSync(updDir) ? fs.readdirSync(updDir) : []) {
      const dir = path.join(updDir, name);
      if (dir !== root && name !== 'staging') fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (e) { root = __dirname; }
}
global.LW_ROOT = root;
global.LW_BUNDLED = __dirname;
require(path.join(root, 'app-main.js'));
