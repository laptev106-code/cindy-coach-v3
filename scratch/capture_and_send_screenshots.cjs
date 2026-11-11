const fs = require('fs');
const os = require('os');
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

async function sendTelegramPhoto(targetChatId, filePath, caption) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n`;
  body += `${targetChatId}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="caption"\r\n\r\n`;
  body += `${caption}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="parse_mode"\r\n\r\n`;
  body += `HTML\r\n`;

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
            console.log(`[Telegram] Sent photo to ${targetChatId}: ${fileName}`);
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

async function sendTelegramMessage(targetChatId, text, replyMarkup = null) {
  const payload = {
    chat_id: targetChatId,
    text: text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
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
  console.log('[Capture] Launching Chrome with dedicated temp profile...');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cindy-shots-'));
  const chromeProcess = spawn(CHROME_PATH, [
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=390,844',
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let cdp = null;
  let stderr = '';
  chromeProcess.stderr.on('data', d => stderr += d.toString());

  try {
    const deadline = Date.now() + 15000;
    while (!stderr.includes('ws://') && Date.now() < deadline) {
      await sleep(50);
    }
    const wsMatch = stderr.match(/ws:\/\/[^\s]+/);
    if (!wsMatch) throw new Error('No wsUrl: ' + stderr);

    const port = new URL(wsMatch[0]).port;
    const targets = await new Promise((res, rej) => {
      http.get(`http://127.0.0.1:${port}/json/list`, resp => {
        let d = ''; resp.on('data', c => d += c); resp.on('end', () => {
          res(JSON.parse(d));
        });
      }).on('error', rej);
    });

    const page = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl) || targets[0];
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    console.log('[Capture] Connected to CDP');

    await cdp.call('Page.enable');
    await cdp.call('DOM.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    const appUrl = 'https://laptev106-code.github.io/cindy-coach-v3/';
    console.log(`[Capture] Navigating to live ${appUrl}`);
    await cdp.call('Page.navigate', { url: appUrl });
    await sleep(2500);

    // Seed configuration: Gennady, 34yo, 180cm, 78kg, copper sports theme
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{
        const cfg = JSON.parse(localStorage.getItem('cindyCfg') || '{}');
        cfg.colorTheme = 'copper';
        cfg.theme = 'light';
        cfg.profile = Object.assign(cfg.profile || {}, {
          name: 'Геннадий',
          age: 34,
          heightCm: 180,
          weightKg: 78,
          trainingExperience: '3 года',
          goal: 'Ритм и устойчивость Cindy V3.'
        });
        localStorage.setItem('cindyCfg', JSON.stringify(cfg));
        if (typeof renderAll === 'function') renderAll({markers: true});
      })()`
    });
    await sleep(600);

    // --- SCREENSHOT 1: Workout Screen (Hero Ball, GPU Timeline, Clean Sports Dock) ---
    console.log('[Capture] Capturing Screen 1: Workout...');
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{ document.getElementById('navWorkout')?.click(); window.scrollTo(0, 0); })()`
    });
    await sleep(1000);
    const shot1 = await cdp.call('Page.captureScreenshot', { format: 'png' });
    const path1 = path.resolve(__dirname, 'screen1_workout.png');
    fs.writeFileSync(path1, Buffer.from(shot1.data, 'base64'));
    console.log('[Capture] Screen 1 saved:', path1);

    // --- SCREENSHOT 2: Apple Bottom Sheet (Swipe Grabber & Form) ---
    console.log('[Capture] Capturing Screen 2: Apple Bottom Sheet...');
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{
        document.getElementById('navProfile')?.click();
        document.querySelector('button.profile-edit')?.click();
      })()`
    });
    await sleep(1000);
    const shot2 = await cdp.call('Page.captureScreenshot', { format: 'png' });
    const path2 = path.resolve(__dirname, 'screen2_bottom_sheet.png');
    fs.writeFileSync(path2, Buffer.from(shot2.data, 'base64'));
    console.log('[Capture] Screen 2 saved:', path2);

    // Close action modal
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{ document.getElementById('actionCancel')?.click(); })()`
    });
    await sleep(400);

    // --- SCREENSHOT 3: Profile Screen (Contrast, WCAG AA, SVG Icons, 12px Floor) ---
    console.log('[Capture] Capturing Screen 3: Profile & Analytics...');
    await cdp.call('Runtime.evaluate', {
      expression: `(()=>{ document.getElementById('navProfile')?.click(); window.scrollTo(0, 0); })()`
    });
    await sleep(1000);
    const shot3 = await cdp.call('Page.captureScreenshot', { format: 'png' });
    const path3 = path.resolve(__dirname, 'screen3_profile.png');
    fs.writeFileSync(path3, Buffer.from(shot3.data, 'base64'));
    console.log('[Capture] Screen 3 saved:', path3);

    // Update menu button with cache busting timestamp to GitHub Pages!
    const liveTimestamp = Date.now();
    const liveMenuUrl = `https://laptev106-code.github.io/cindy-coach-v3/?v=${liveTimestamp}`;
    await updateMenuButton(liveMenuUrl);
    console.log(`[Telegram] Menu button permanently set to: ${liveMenuUrl}`);

    // Send screenshots to Gennady chat
    console.log('[Telegram] Sending screenshots to chat', CHAT_ID);
    
    await sendTelegramPhoto(CHAT_ID, path1, 
      `🔥 <b>1/3. Экран тренировки (Apple Motion 120 FPS):</b>\n\n` +
      `• Таймлайн ритма переведён на аппаратный GPU-композитор (scaleX).\n` +
      `• Hero Ball пульсирует без покадрового пересчёта теней и размытий.\n` +
      `• Плавный скраббер нижней навигации с тактильным переключением экранов.`
    );

    await sendTelegramPhoto(CHAT_ID, path2, 
      `📱 <b>2/3. Нативная шторка Apple Bottom Sheet:</b>\n\n` +
      `• Добавлена тактильная ручка захвата (.sheet-grabber).\n` +
      `• Окно смахивается вниз с физическим сопротивлением и пружиной.\n` +
      `• Внутренний скролл формы изолирован и не закрывает окно.`
    );

    await sendTelegramPhoto(CHAT_ID, path3, 
      `✨ <b>3/3. Профиль и настройки (WCAG AA и чистый UI):</b>\n\n` +
      `• Высокий контраст всех кнопок и тестов (>= 4.5:1).\n` +
      `• Чёткий пол типографики >= 12px (без мелкого микротекста).\n` +
      `• Все цифры с tabular-nums (ноль скачков ширины).`
    );

    // Send interactive launch button
    await sendTelegramMessage(CHAT_ID,
      `✅ <b>CINDY Coach V3 развёрнут на GitHub Pages!</b>\n\n` +
      `Ранее в боте была прописана ссылка на временный туннель Cloudflare, который отключился — поэтому приложение не открывалось.\n\n` +
      `Сейчас кнопка меню бота обновлена на постоянный адрес. Нажмите кнопку ниже для запуска:`,
      {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть CINDY Coach V3',
              web_app: { url: liveMenuUrl }
            }
          ]
        ]
      }
    );

    console.log('[Done] All screenshots and launch button sent successfully.');
  } finally {
    if (cdp) cdp.close();
    try { chromeProcess.kill(); } catch (_) {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

run().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
