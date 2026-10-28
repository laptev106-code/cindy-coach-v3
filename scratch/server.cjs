const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = path.resolve(__dirname, '..');
const BOT_TOKEN = '8640229449:AAFusAB-RYyabVAxE6Aox6joTgNDnBMHK0g';
const CHAT_ID_FILE = path.join(__dirname, 'feedback_chat_id.txt');
const ARCHIVE_FILE = path.join(__dirname, 'feedback_archive.jsonl');

let cachedChatId = '';
if (fs.existsSync(CHAT_ID_FILE)) {
  try { cachedChatId = fs.readFileSync(CHAT_ID_FILE, 'utf8').trim(); } catch (_) {}
}

function sendTelegramMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    });
    const req = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Background auto-discovery for Channel or Admin chat ID
let lastUpdateId = 0;
async function pollTelegramUpdates() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&limit=10`;
    https.get(url, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', async () => {
        try {
          const json = JSON.parse(raw);
          if (json.ok && Array.isArray(json.result)) {
            for (const upd of json.result) {
              if (upd.update_id > lastUpdateId) lastUpdateId = upd.update_id;
              const chat = upd.my_chat_member?.chat || upd.channel_post?.chat || upd.message?.chat;
              if (chat && chat.id) {
                cachedChatId = String(chat.id);
                fs.writeFileSync(CHAT_ID_FILE, cachedChatId, 'utf8');
                console.log(`[Coach Support] Detected target chat/channel ID: ${cachedChatId} (${chat.title || chat.username || chat.first_name || 'chat'})`);
              }
            }
          }
        } catch (_) {}
      });
    }).on('error', () => {});
  } catch (_) {}
}
setInterval(pollTelegramUpdates, 8000);
pollTelegramUpdates();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // Handle Feedback API Endpoint
  if (req.method === 'POST' && reqPath === '/api/feedback') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const typeLabels = {
          feature: { tag: '#ПРЕДЛОЖЕНИЕ', title: '💡 ПРЕДЛОЖЕНИЕ ПО УЛУЧШЕНИЮ' },
          error: { tag: '#БАГ', title: '🐞 СООБЩЕНИЕ ОБ ОШИБКЕ' },
          contact: { tag: '#ВОПРОС', title: '❓ ВОПРОС / ПОМОЩЬ' },
          review: { tag: '#ОТЗЫВ', title: '⭐ ОТЗЫВ' },
        };
        const info = typeLabels[payload.type] || { tag: '#ОБРАЩЕНИЕ', title: '💬 ОБРАЩЕНИЕ' };
        const user = payload.user || {};
        const userName = user.first_name ? (user.first_name + (user.last_name ? ' ' + user.last_name : '')) : (user.name || 'Пользователь');
        const userHandle = user.username ? `@${user.username}` : (user.id ? `ID: ${user.id}` : '—');
        const platform = payload.platform || 'Telegram WebApp';
        const messageText = String(payload.message || '').trim();
        const dateStr = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

        const tgMessage = [
          `🔔 <b>${info.title}</b> ${info.tag}`,
          ``,
          `👤 <b>От:</b> ${userName} (${userHandle})`,
          `📱 <b>Платформа:</b> ${platform}`,
          `⚙️ <b>Версия:</b> CINDY Coach V3`,
          `⏱ <b>Время:</b> ${dateStr} (МСК)`,
          ``,
          `💬 <b>Текст обращения:</b>`,
          `<blockquote>${messageText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</blockquote>`,
        ].join('\n');

        // Target chat ID from file or cache
        let targetChatId = cachedChatId;
        if (!targetChatId && fs.existsSync(CHAT_ID_FILE)) {
          targetChatId = fs.readFileSync(CHAT_ID_FILE, 'utf8').trim();
        }

        if (targetChatId) {
          try {
            await sendTelegramMessage(targetChatId, tgMessage);
            console.log(`[Coach Support] Feedback dispatched to ${targetChatId}`);
          } catch (sendErr) {
            console.error('[Coach Support] Send error:', sendErr);
          }
        } else {
          console.log('[Coach Support] No targetChatId configured yet; saved to archive.');
        }

        // Persist to local JSONL archive
        fs.appendFileSync(ARCHIVE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), payload }) + '\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, delivered: Boolean(targetChatId) }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Handle Cloud Sync API Endpoint
  if (reqPath === '/api/sync') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const userId = payload.user?.id || '136681806';
          const syncFile = path.join(__dirname, `sync_user_${userId}.json`);
          fs.writeFileSync(syncFile, JSON.stringify(payload.snapshot || payload, null, 2), 'utf8');
          console.log(`[Cloud Sync] Saved snapshot for user ${userId}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, syncedAt: Date.now() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }
    if (req.method === 'GET') {
      const urlObj = new URL(req.url, 'http://127.0.0.1');
      const userId = urlObj.searchParams.get('userId') || '136681806';
      const syncFile = path.join(__dirname, `sync_user_${userId}.json`);
      if (fs.existsSync(syncFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(syncFile, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, snapshot: data }));
          return;
        } catch (_) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, snapshot: null }));
      return;
    }
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath.replace(/^\/+/, ''));

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallback = path.join(ROOT, 'index.html');
    if (fs.existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallback).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CINDY Coach V3 Server running at http://127.0.0.1:${PORT}/`);
});
