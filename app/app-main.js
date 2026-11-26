// THE LAST WITNESS — Electron main process
const { app, BrowserWindow, protocol, net, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = __dirname; // when an update is installed this is %APPDATA%/<game>/update/app-<version>
const updater = require('./updater.js');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// automated tests use a throw-away profile so they never touch the player's real save
if (process.env.LW_USERDATA) app.setPath('userData', process.env.LW_USERDATA);
if (process.env.LW_ANGLE) app.commandLine.appendSwitch('use-angle', process.env.LW_ANGLE);
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let win;
const savePath = () => path.join(app.getPath('userData'), 'save.json');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 650,
    backgroundColor: '#07080a',
    title: 'الشاهد الأخير — THE LAST WITNESS',
    icon: path.join(ROOT, 'src', 'img', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => { win.show(); if (process.env.LW_FULLSCREEN === '1') win.setFullScreen(true); });
  win.loadURL('app://game/src/index.html' + (process.env.LW_QUERY ? '?' + process.env.LW_QUERY : ''));

  if (process.env.LW_LOG) {
    win.webContents.on('console-message', (_e, level, msg, line, src) => { if (level >= 1) console.log(`[R${level}] ${msg} (${String(src).split('/').pop()}:${line})`); });
    win.webContents.session.webRequest.onErrorOccurred(d => console.log('[NET] ' + d.error + ' ' + d.url.slice(0, 160)));
  }
  if (process.env.LW_EVAL) {
    win.webContents.on('did-finish-load', () => setTimeout(() => win.webContents.executeJavaScript(process.env.LW_EVAL).then(r => console.log('[EVAL]', JSON.stringify(r))).catch(e => console.log('[EVAL-ERR]', e.message)), Number(process.env.LW_EVAL_DELAY || 20000)));
  }
  // automated screenshot for testing: LW_SHOT=path.png LW_SHOT_DELAY=ms
  if (process.env.LW_SHOT) {
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.LW_SHOT, img.toPNG());
      app.quit();
    }, Number(process.env.LW_SHOT_DELAY || 15000));
  }
}

app.whenReady().then(() => {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    try {
      const data = await fs.promises.readFile(file);
      return new Response(data, { status: 200, headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  ipcMain.handle('save:read', () => readJSON(savePath()) || readJSON(savePath() + '.bak'));
  ipcMain.handle('save:write', (_e, data) => {
    const p = savePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak');
    fs.writeFileSync(p + '.tmp', JSON.stringify(data));
    fs.renameSync(p + '.tmp', p);
    return true;
  });
  ipcMain.handle('save:path', () => savePath());
  ipcMain.handle('app:fullscreen', (_e, on) => { win.setFullScreen(!!on); return win.isFullScreen(); });
  ipcMain.handle('app:quit', () => app.quit());
  // updates
  ipcMain.handle('update:info', () => ({ version: updater.version, enabled: updater.enabled() || !!process.env.LW_FORCE_UPDATER }));
  ipcMain.handle('update:check', async () => { try { return await updater.check(); } catch (e) { return { available: false, error: e.message }; } });
  ipcMain.handle('update:download', async (e) => {
    try { return await updater.download(p => { if (!e.sender.isDestroyed()) e.sender.send('update:progress', p); }); }
    catch (err) { return { error: err.message }; }
  });
  ipcMain.handle('update:restart', () => { app.relaunch(); app.exit(0); });
  // automated testing only: synthesize real OS-level input events
  ipcMain.handle('test:input', (_e, evts) => { if (!process.env.LW_SHOT_DIR) return false; for (const ev of evts) win.webContents.sendInputEvent(ev); return true; });
  // automated testing only: capture a named screenshot into LW_SHOT_DIR
  ipcMain.handle('test:shot', async (_e, name) => {
    if (!process.env.LW_SHOT_DIR) return false;
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(process.env.LW_SHOT_DIR, name + '.png'), img.resize({ width: 1280 }).toPNG());
    return true;
  });

  if (process.env.LW_BAKE) return bakeAnims();
  createWindow();
});

// One-time asset step: FBX animations -> compact JSON clips (npm run bake)
async function bakeAnims() {
  const dir = path.join(ROOT, 'assets', 'anims');
  const names = fs.readdirSync(dir).filter(f => f.endsWith('.fbx')).map(f => f.slice(0, -4));
  const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await w.loadURL('app://game/tools/bake.html');
  for (let i = 0; i < 50 && !(await w.webContents.executeJavaScript('!!window.bakeReady')); i++) await new Promise(r => setTimeout(r, 100));
  for (const n of names) {
    const res = await w.webContents.executeJavaScript(`bake(${JSON.stringify([n])})`);
    fs.writeFileSync(path.join(dir, n + '.json'), JSON.stringify(res[n]));
    console.log('baked', n);
  }
  app.quit();
}

app.on('window-all-closed', () => app.quit());
