const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

const BOT_TOKEN = '8640229449:AAFusAB-RYyabVAxE6Aox6joTgNDnBMHK0g';
const CHAT_ID = '136681806';
const CHROME_PATH = process.env.CHROMIUM_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function connectCdp(targetUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(targetUrl);
    const pending = new Map();
    let nextId = 0, closed = false;

    socket.addEventListener('open', () => resolve({
      socket,
      call(method, params = {}) {
        if (closed) return Promise.reject(new Error('Chrome DevTools connection is closed'));
        const id = ++nextId;
        return new Promise((res, rej) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            rej(new Error(`CDP timeout: ${method}`));
          }, 15000);
          pending.set(id, { res, rej, timer, method });
          socket.send(JSON.stringify({ id, method, params }));
        });
      },
      close() {
        closed = true;
        try { socket.close(); } catch (_) {}
      }
    }));

    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch (_) { return; }
      if (!message.id) return;
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (message.error) item.rej(new Error(`${item.method}: ${message.error.message}`));
      else item.res(message.result || message);
    });

    socket.addEventListener('error', () => reject(new Error('Chrome DevTools WebSocket connection failed')));
    socket.addEventListener('close', () => {
      closed = true;
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.rej(new Error('Chrome DevTools connection closed'));
      }
      pending.clear();
    });
  });
}

async function sendTelegramPhoto(filePath, caption) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n`;
  body += `${CHAT_ID}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="caption"\r\n\r\n`;
  body += `${caption}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="photo"; filename="${fileName}"\r\n`;
  body += `Content-Type: image/png\r\n\r\n`;

  const bodyEnd = `\r\n--${boundary}--\r\n`;
  const fullBody = Buffer.concat([
    Buffer.from(body, 'utf8'),
    fileData,
    Buffer.from(bodyEnd, 'utf8')
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            console.log(`[Telegram] Sent photo: ${fileName}`);
            resolve(json);
          } else {
            console.error(`[Telegram] Error sending photo ${fileName}:`, json);
            reject(new Error(json.description));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function updateMenuButton(url) {
  const payload = JSON.stringify({
    menu_button: {
      type: 'web_app',
      text: 'Тренироваться',
      web_app: { url }
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('[Telegram] Menu button update response:', data);
        resolve(data);
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('[Capture] Launching Chrome...');
  const port = 9333;
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=390,844',
    'about:blank'
  ]);

  let cdp = null;
  try {
    await sleep(1500);

    // Get list of targets
    const target = await new Promise((res, rej) => {
      http.get(`http://127.0.0.1:${port}/json/list`, resp => {
        let d = ''; resp.on('data', c => d += c); resp.on('end', () => {
          const list = JSON.parse(d);
          const page = list.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
          if (page) res(page);
          else rej(new Error('No page target found'));
        });
      }).on('error', rej);
    });

    cdp = await connectCdp(target.webSocketDebuggerUrl);
    console.log('[Capture] Connected to CDP page target');

    await cdp.call('Page.enable');
    await cdp.call('DOM.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    const appUrl = 'http://127.0.0.1:8080/';
    console.log(`[Capture] Navigating to ${appUrl}`);
    await cdp.call('Page.navigate', { url: appUrl });
    await sleep(2000);

    // Seed configuration: Gennady, 31yo, 180cm, 78kg, copper sports theme
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{
        const cfg = JSON.parse(localStorage.getItem('cindyCfg') || '{}');
        cfg.colorTheme = 'copper';
        cfg.theme = 'light';
        cfg.profile = Object.assign(cfg.profile || {}, {
          name: 'Геннадий',
          age: 31,
          heightCm: 180,
          weightKg: 78,
          goal: 'Откройте свой ритм через реальные тренировки.',
          avatarTone: 'ember'
        });
        localStorage.setItem('cindyCfg', JSON.stringify(cfg));
        if (typeof renderAll === 'function') renderAll({markers: true});
      })()`
    });
    await sleep(500);

    // --- SCREENSHOT 1: Profile (Unified Profile Card + Activity Stats Card) ---
    console.log('[Capture] Capturing Screen 1: Profile...');
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{ document.getElementById('navProfile')?.click(); window.scrollTo(0, 0); })()`
    });
    await sleep(1000);
    const shot1 = await cdp.call('Page.captureScreenshot', { format: 'png' });
    const path1 = path.resolve(__dirname, 'screen1_profile.png');
    fs.writeFileSync(path1, Buffer.from(shot1.data, 'base64'));
    console.log('[Capture] Screen 1 saved:', path1);

    // --- SCREENSHOT 2: Settings -> Data & Sync (Cloud Sync Card) ---
    console.log('[Capture] Capturing Screen 2: Data & Cloud Sync...');
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{
        const btn = document.querySelector('button[data-stage2-category="data"]');
        if (btn) btn.click();
        const section = document.getElementById('profileSettingsDetail-data');
        if (section) section.scrollIntoView({behavior: 'instant', block: 'start'});
      })()`
    });
    await sleep(1000);
    const shot2 = await cdp.call('Page.captureScreenshot', { format: 'png' });
    const path2 = path.resolve(__dirname, 'screen2_sync.png');
    fs.writeFileSync(path2, Buffer.from(shot2.data, 'base64'));
    console.log('[Capture] Screen 2 saved:', path2);

    // --- SCREENSHOT 3: Workout / Plan (Fixed layout, sport theme, single-line cards) ---
    console.log('[Capture] Capturing Screen 3: Workout...');
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{ document.getElementById('navWorkout')?.click(); window.scrollTo(0, 0); })()`
    });
    await sleep(1000);
    const shot3 = await cdp.call('Page.captureScreenshot', { format: 'png' });
    const path3 = path.resolve(__dirname, 'screen3_workout.png');
    fs.writeFileSync(path3, Buffer.from(shot3.data, 'base64'));
    console.log('[Capture] Screen 3 saved:', path3);

    // Send all three to Telegram!
    console.log('[Telegram] Sending screenshots to chat', CHAT_ID);
    
    await sendTelegramPhoto(path1, 
      `📸 1/3. Профиль (Единая карта атлета + Тренировочная активность):\n\n` +
      `✅ «Геннадий» и «Данные для тренера» объединены в одну монолитную карточку (без лишних блоков и градиентных разрывов).\n` +
      `✅ Фильтры периодов (7 ДНЕЙ / 28 ДНЕЙ / ВСЁ ВРЕМЯ) и показатели (СЕССИИ / СЕРИЯ / ЛУЧШИЙ) объединены в единую сводку активности.\n` +
      `✅ Зафиксирован мобильный вьюпорт: зум и горизонтальное смещение заблокированы.`
    );

    await sendTelegramPhoto(path2, 
      `📸 2/3. Настройки -> Данные и синхронизация:\n\n` +
      `✅ Полностью убран технический шум (OAuth Client ID, Google Cloud и т.д.).\n` +
      `✅ Добавлена понятная карточка «ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ» со статусом «● АВТОМАТИЧЕСКИ».\n` +
      `✅ Все данные тренировок сохраняются автоматически под капотом сразу после завершения занятия.`
    );

    await sendTelegramPhoto(path3, 
      `📸 3/3. Тренировка / Сингл-лайн упражнения и спортивная тема «Медь»:\n\n` +
      `✅ Тема «Медь» обновлена в спортивный оранжево-титановый градиент без ухода в жёлтый/коричневый.\n` +
      `✅ Убрано лишнее дублирование текста («5 подтягиваний») — упражнение пишется заглавными, справа счётчик («5 повт.»).\n` +
      `✅ Экран зафиксирован, исключены случайные сдвиги и масштабирование веб-страницы.`
    );

    // Update menu button with cache busting timestamp
    const menuUrl = `https://skcs4s-ip-31-7-63-34.tunnelmole.net/?v=${Date.now()}`;
    await updateMenuButton(menuUrl);
    console.log(`[Telegram] Menu button updated to: ${menuUrl}`);

  } finally {
    if (cdp) cdp.close();
    try { chromeProcess.kill(); } catch (_) {}
  }
}

run().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
