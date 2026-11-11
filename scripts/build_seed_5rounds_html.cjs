const fs = require('fs');
const seedData = JSON.parse(fs.readFileSync('seed_5rounds_data.json', 'utf8'));

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CINDY Coach V3 — Запись теста (10 мин / 5 кругов)</title>
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(18, 24, 38, 0.85);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f0f4f8;
      --text-muted: #8a99ad;
      --accent: #d55a32;
      --accent-glow: rgba(213, 90, 50, 0.25);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body {
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background-image: radial-gradient(circle at 50% 20%, rgba(213, 90, 50, 0.12) 0%, transparent 60%);
    }
    .container {
      max-width: 520px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px 24px;
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--accent);
      background: rgba(213, 90, 50, 0.15);
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 24px; }
    .session-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
    .session-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .session-title { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
    .session-meta { font-size: 12px; color: var(--text-muted); }
    .session-rounds { font-size: 18px; font-weight: 700; color: var(--accent); }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #d55a32 0%, #b8431e 100%);
      color: #fff;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      box-shadow: 0 8px 20px var(--accent-glow);
      transition: all 0.2s ease;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px var(--accent-glow); }
    .status-text { margin-top: 16px; font-size: 12px; color: #7ee787; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">CINDY COACH V3 — КАЛИБРОВКА</div>
    <h1>Тест зафиксирован: 5 кругов</h1>
    <p>В систему внесена тестовая тренировка: <b>10 минут · 5 кругов</b> (5 подтягиваний · 10 отжиманий · 15 приседаний). Тренер сразу готов выдать рекомендацию.</p>
    
    <div class="session-list">
      <div class="session-card">
        <div>
          <div class="session-title">Вводный тест Cindy (10 минут)</div>
          <div class="session-meta">5 подт. · 10 отж. · 15 прис. · темп: 120с / круг</div>
        </div>
        <div class="session-rounds">5 кругов</div>
      </div>
    </div>

    <a href="index.html" class="btn" id="openAppBtn">ОТКРЫТЬ CINDY И ПРОВЕРИТЬ ТРЕНЕРА</a>
    <div class="status-text" id="statusMessage">Записываем результат теста в память приложения...</div>
  </div>

  <script>
    const data = ${JSON.stringify(seedData)};
    try {
      localStorage.setItem('cindyCfg', JSON.stringify(data.cindyCfg));
      localStorage.setItem('cindyHistory', JSON.stringify(data.cindyHistory));
      localStorage.setItem('cindyCoachV3State', JSON.stringify(data.cindyCoachV3State));
      document.getElementById('statusMessage').textContent = '✓ Тест успешно записан! Перенаправляем к тренеру...';
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);
    } catch (e) {
      document.getElementById('statusMessage').textContent = 'Ошибка сохранения: ' + e.message;
    }
  </script>
</body>
</html>
`;

fs.writeFileSync('seed_test_5rounds.html', html, 'utf8');
console.log('Created seed_test_5rounds.html successfully!');
