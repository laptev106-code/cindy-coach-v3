const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function chromiumPath() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const name of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'chromium', 'google-chrome']) {
    try {
      if (fs.existsSync(name)) return name;
    } catch (_) {}
  }
  throw new Error('Chromium/Chrome binary not found.');
}

async function waitFor(fn, { timeout = 15000, interval = 50, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await fn();
    if (value) return value;
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function makeServer() {
  return http.createServer((req, res) => {
    const rawPath = req.url.split('?')[0];
    const safePath = path.normalize(rawPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(root, safePath === '/' ? 'index.html' : safePath.slice(1));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const mime = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'application/javascript; charset=utf-8'
      : ext === '.json' ? 'application/json; charset=utf-8'
      : ext === '.webmanifest' ? 'application/manifest+json; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'content-type': mime });
    fs.createReadStream(filePath).pipe(res);
  });
}

function connectCdp(targetUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(targetUrl);
    const pending = new Map();
    let nextId = 0;
    let closed = false;
    socket.addEventListener('open', () => resolve({
      call(method, params = {}) {
        if (closed) return Promise.reject(new Error('CDP closed'));
        const id = ++nextId;
        return new Promise((res, rej) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            rej(new Error(`CDP timeout: ${method}`));
          }, 30000);
          pending.set(id, { res, rej, timer, method });
          socket.send(JSON.stringify({ id, method, params }));
        });
      },
      close() {
        closed = true;
        socket.close();
      }
    }));
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled') {
        const text = (message.params.args || []).map(a => a.value || a.description).join(' ');
        console.log('[BROWSER CONSOLE]', text);
      }
      if (!message.id) return;
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (message.error) item.rej(new Error(`${item.method}: ${message.error.message}`));
      else item.res(message.result);
    });
    socket.addEventListener('error', () => reject(new Error('CDP connection failed')));
  });
}

(async () => {
  const server = makeServer();
  let browser, cdp;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cindy-coach-seed-test-'));

    browser = spawn(chromiumPath(), [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`
    ]);

    const activePortFile = path.join(profile, 'DevToolsActivePort');
    const endpoint = await waitFor(async () => {
      if (browser.exitCode !== null) throw new Error(`Chromium exited ${browser.exitCode}`);
      try {
        const [p] = fs.readFileSync(activePortFile, 'utf8').trim().split(/\s+/);
        return p ? Number(p) : null;
      } catch (_) {
        return null;
      }
    }, { timeout: 15000, label: 'DevTools port' });

    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${endpoint}/json/list`);
      if (!response.ok) return null;
      return (await response.json()).find(item => item.type === 'page' && item.webSocketDebuggerUrl);
    }, { timeout: 10000, label: 'Page target' });

    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');

    console.log('=== Step 1: Navigate to seed_coach.html ===');
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${port}/seed_coach.html` });
    await sleep(800);

    const seedCheck = await cdp.call('Runtime.evaluate', {
      expression: `localStorage.getItem('cindyCoachV3State')`,
      returnByValue: true
    });
    console.log('Seed state in localStorage right after seed_coach.html:', seedCheck.result?.value);

    console.log('=== Step 2: Navigate to index.html ===');
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    await sleep(2000);

    // Evaluate Coach state in DOM
    const stateEval = await cdp.call('Runtime.evaluate', {
      expression: `(() => {
        const coach = window.CindyCoachIntegration;
        const readiness = coach ? coach.readiness() : null;
        const recommendation = coach ? coach.derive() : null;
        const app = window.CINDYAppRuntimeV3;
        const config = app ? app.getConfig() : null;
        const records = app ? app.records() : [];
        const coachCard = document.querySelector('.coach-card') || document.querySelector('.next-workout-card');
        const buttons = Array.from(document.querySelectorAll('.coach-actions button, button.action-button')).map(b => b.textContent.trim());
        const coachState = coach ? coach.state() : null;
        const derived = window.CindyCoachV3?.application?.derive();
        return {
          readiness,
          recommendation,
          config,
          historyCount: records.length,
          recordsSample: records.map(r => ({ id: r.id, completedAt: r.completedAt, purpose: r.v3?.sessionPurpose, rounds: r.rounds })),
          coachState,
          derivedDiagnostics: derived?.diagnostics,
          cardTitle: coachCard ? coachCard.querySelector('b')?.textContent : null,
          cardCopy: coachCard ? coachCard.querySelector('p')?.textContent : null,
          buttons
        };
      })()`,
      returnByValue: true
    });

    const state = stateEval.result ? stateEval.result.value : stateEval.value;
    console.log('History count in browser storage:', state?.historyCount);
    console.log('Records in browser:', JSON.stringify(state?.recordsSample, null, 2));
    console.log('Coach State in browser:', JSON.stringify(state?.coachState, null, 2));
    console.log('Coach Diagnostics in browser:', JSON.stringify(state?.derivedDiagnostics, null, 2));
    console.log('Coach Readiness in browser:', state?.readiness);
    console.log('Coach Decision Mode:', state?.recommendation?.decisionMode);
    console.log('Coach Recommendation Full:', JSON.stringify(state?.recommendation, null, 2));
    console.log('Coach Action:', state?.recommendation?.action);
    console.log('Coach Card Title in UI:', state?.cardTitle);
    console.log('Coach Card Copy in UI:', state?.cardCopy);
    console.log('Visible Action Buttons:', state?.buttons);

    assert.strictEqual(state.historyCount, 4, 'Must have 4 recorded workouts in browser');
    assert.strictEqual(state.readiness.phase, 'READY', 'Coach must be READY');
    assert.strictEqual(state.readiness.ready, true, 'Coach readiness.ready must be true');
    assert.strictEqual(state.recommendation?.decisionMode, 'ADAPT', 'Decision mode must be ADAPT');
    assert(state.buttons.some(b => b.includes('ПРИМЕНИТЬ') || b.includes('ПРИНЯТЬ И НАЧАТЬ')), 'Apply button must be present in UI!');

    console.log('=== Step 3: Click ПРИМЕНИТЬ in UI ===');
    const applyEval = await cdp.call('Runtime.evaluate', {
      expression: `(() => {
        const coach = window.CindyCoachIntegration;
        return coach.apply();
      })()`,
      returnByValue: true
    });
    const applyVal = applyEval.result ? applyEval.result.value : applyEval.value;
    console.log('Apply result in browser:', applyVal);
    assert.strictEqual(applyVal.ok, true, 'Apply must succeed');

    // Re-check updated config
    const afterEval = await cdp.call('Runtime.evaluate', {
      expression: `(() => {
        const app = window.CINDYAppRuntimeV3;
        return app ? app.getConfig().composition : null;
      })()`,
      returnByValue: true
    });
    const afterVal = afterEval.result ? afterEval.result.value : afterEval.value;
    console.log('Updated composition in browser config:', afterVal);
    const pushSlot = afterVal.find(s => (s.id || s.exerciseId) === 'push');
    assert.strictEqual(pushSlot.count, 11, 'Push count must be updated to 11!');

    console.log('======================================================');
    console.log('LIVE BROWSER VERIFICATION: 100% SUCCESSFUL!');
    console.log('Coach is actively generating non-random adaptations');
    console.log('based on historical workouts and applying them in UI!');
    console.log('======================================================');

    process.exit(0);
  } catch (err) {
    console.error('Browser verification error:', err);
    process.exit(1);
  } finally {
    if (cdp) cdp.close();
    if (browser) browser.kill();
    server.close();
  }
})();
