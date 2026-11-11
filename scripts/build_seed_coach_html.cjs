const fs = require('fs');
const path = require('path');

const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, '../seed_data.json'), 'utf8'));

const storageData = {
  cindyCfg: seedData.cindyCfg,
  cindyHistory: seedData.cindyHistory,
  cindyCoachV3State: seedData.cindyCoachV3State
};

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CINDY — Запись тестовых тренировок</title>
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(18, 24, 38, 0.85);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f0f4f8;
      --text-muted: #8a99ad;
      --accent: #10b981;
      --accent-glow: rgba(16, 185, 129, 0.25);
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
      background-image: radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 60%);
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
      background: rgba(16, 185, 129, 0.15);
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 24px; }
    .session-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }
    .session-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
    }
    .session-title { font-weight: 600; color: #fff; }
    .session-meta { color: var(--text-muted); font-size: 12px; }
    .session-rounds { font-weight: 700; color: var(--accent); }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      background: var(--accent);
      color: #041a11;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.04em;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: 0 4px 20px var(--accent-glow);
    }
    .btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .status-text {
      text-align: center;
      font-size: 13px;
      color: var(--accent);
      margin-top: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">ТЕСТОВЫЕ ДАННЫЕ ТРЕНЕРА</span>
    <h1>Тренировки записаны в приложение</h1>
    <p>В хранилище приложения записана история из базового теста и 3 завершённых дней с прогрессирующей нагрузкой. Тренер готов выдать усложнение программы.</p>
    
    <div class="session-list">
      <div class="session-item">
        <div>
          <div class="session-title">Тестовая тренировка (Baseline)</div>
          <div class="session-meta">10 минут · 5 / 10 / 15</div>
        </div>
        <div class="session-rounds">6 кругов</div>
      </div>
      <div class="session-item">
        <div>
          <div class="session-title">День 1 (2026-10-02)</div>
          <div class="session-meta">10 минут · pull_neutral: 5, push: 10, squat: 15</div>
        </div>
        <div class="session-rounds">10 кругов</div>
      </div>
      <div class="session-item">
        <div>
          <div class="session-title">День 2 (2026-10-03)</div>
          <div class="session-meta">10 минут · pull_neutral: 5, push: 10, squat: 15</div>
        </div>
        <div class="session-rounds">11 кругов</div>
      </div>
      <div class="session-item">
        <div>
          <div class="session-title">День 3 (2026-10-04)</div>
          <div class="session-meta">10 минут · pull_neutral: 5, push: 10, squat: 15</div>
        </div>
        <div class="session-rounds">12 кругов</div>
      </div>
    </div>

    <a href="index.html" class="btn" id="openAppBtn">ОТКРЫТЬ CINDY И ПРОВЕРИТЬ ТРЕНЕРА</a>
    <div class="status-text" id="statusMessage">Записываем данные в память приложения...</div>
  </div>

  <script>
    const data = ${JSON.stringify(storageData)};
    try {
      localStorage.setItem('cindyCfg', JSON.stringify(data.cindyCfg));
      localStorage.setItem('cindyHistory', JSON.stringify(data.cindyHistory));
      localStorage.setItem('cindyCoachV3State', JSON.stringify(data.cindyCoachV3State));
      document.getElementById('statusMessage').textContent = '✓ Данные успешно сохранены! Перенаправляем на главную через 2 секунды...';
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    } catch (e) {
      document.getElementById('statusMessage').textContent = 'Ошибка сохранения: ' + e.message;
    }
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '../seed_coach.html'), html, 'utf8');
console.log('seed_coach.html built successfully!');
