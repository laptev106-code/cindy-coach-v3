---
name: capacitor-mobile-runtime
description: "Упаковка и нативный мост для Vanilla JS / PWA веб-приложений в мобильные сборки iOS (IPA) и Android (APK/AAB) через Capacitor. Нативные плагины: хаптики (@capacitor/haptics), запрет сна экрана (@capacitor-community/keep-awake), статус-бар (@capacitor/status-bar), оффлайн-кэш и сборка без переписывания веб-кода на React Native. Активируется на 'capacitor', 'нативное приложение', 'apk', 'android билд', 'ios билд', 'упакуй в приложение'."
---

# Capacitor Mobile Runtime: Инженерный Стандарт Мобильного Моста (Web → Native)

Регламент бесшовной трансформации готового высокопроизводительного Vanilla JS / PWA веб-ядра в полноценное нативное мобильное приложение (Android APK / iOS) без переписывания бизнес-логики и верстки на чужеродные фреймворки (React Native, Flutter).

---

## 1. Архитектурный Манифест (Почему Capacitor, а не Expo)

| Критерий | Vanilla JS + Capacitor | Переписывание на React Native / Expo |
|---|---|---|
| **Сохранность кодовой базы** | **100%** (все 5 экранов, 800 КБ кода, 26 тест-сьютов работают как есть) | **0%** (полное переписывание всех экранов и логики с нуля) |
| **Срок готовности билда** | **15–30 минут** (настройка конфига и синхронизация) | **2–3 месяца** (разработка параллельного проекта) |
| **Качество верстки и 3D** | **100% идентичность** мастер-дизайну (многослойные тени, точные фаски, FLUX) | Риск получить плоский «игрушечный» муляж (AI slop) |
| **Аудио и таймеры** | Web Audio API + Speech Synthesis работают нативно | Необходимость адаптации под `expo-av` и `expo-speech` |
| **Доступ к железу** | Нативные плагины через прямой JavaScript-бридж | Нативные модули через JSX |

---

## 2. Структура Конфигурации (`capacitor.config.json`)

Файл конфигурации размещается в корне проекта:

```json
{
  "appId": "com.cindycoach.app",
  "appName": "CINDY Coach",
  "webDir": ".",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 1200,
      "launchAutoHide": true,
      "backgroundColor": "#070b12",
      "androidSplashResourceName": "splash",
      "showSpinner": false
    },
    "StatusBar": {
      "style": "DARK",
      "backgroundColor": "#070b12",
      "overlaysWebView": false
    },
    "KeepAwake": {
      "supported": true
    }
  }
}
```

> [!IMPORTANT]
> Параметр `webDir` указывает на директорию с `index.html`. Для CINDY Coach V3 это корень проекта (`.`) либо подготовленная директория дистрибутива. Все пути к скриптам и ассетам в `index.html` обязаны быть **относительными** (`./src/...`, а не `/src/...`).

---

## 3. Нативные Аппаратные Мосты (Hardware Bridges)

В коде приложения используется фасадная обертка с автоматическим определением среды (Capacitor Native vs Браузер):

```javascript
// Адаптер нативного железа с веб-фоллбэком
window.CindyNativeBridge = {
  isNative: Boolean(window.Capacitor?.isNativePlatform()),

  // 1. Тактильный виброотклик (Haptics)
  async hapticImpact(style = 'heavy') {
    if (this.isNative && window.Capacitor?.Plugins?.Haptics) {
      const { Haptics, ImpactStyle } = window.Capacitor.Plugins;
      const map = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      };
      await Haptics.impact({ style: map[style] || ImpactStyle.Heavy });
      return;
    }
    // Fallback для веба / Telegram WebApp
    if (navigator.vibrate) {
      const patterns = { light: 15, medium: 35, heavy: [60, 40, 60] };
      navigator.vibrate(patterns[style] || 40);
    }
  },

  // 2. Запрет засыпания экрана во время тренировки (Keep Awake)
  async setKeepAwake(enable = true) {
    if (this.isNative && window.Capacitor?.Plugins?.KeepAwake) {
      const { KeepAwake } = window.Capacitor.Plugins;
      if (enable) await KeepAwake.keepAwake();
      else await KeepAwake.allowSleep();
      return;
    }
    // Fallback через Screen Wake Lock API
    if ('wakeLock' in navigator) {
      try {
        if (enable && !window._cindyWakeLock) {
          window._cindyWakeLock = await navigator.wakeLock.request('screen');
        } else if (!enable && window._cindyWakeLock) {
          await window._cindyWakeLock.release();
          window._cindyWakeLock = null;
        }
      } catch (_) {}
    }
  },

  // 3. Синхронизация цвета статус-бара с темой
  async setStatusBarStyle(themeMode = 'dark', colorHex = '#070b12') {
    if (this.isNative && window.Capacitor?.Plugins?.StatusBar) {
      const { StatusBar, Style } = window.Capacitor.Plugins;
      await StatusBar.setStyle({ style: themeMode === 'dark' ? Style.Dark : Style.Light });
      if (window.Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: colorHex });
      }
    }
  }
};
```

---

## 4. Командный Пайплайн Сборки

```powershell
# 1. Инициализация (выполняется один раз)
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/haptics @capacitor/status-bar @capacitor-community/keep-awake

# 2. Добавление платформы Android
npx cap add android

# 3. Синхронизация изменений веба в Android проект (после каждой правки HTML/CSS/JS)
npx cap sync android

# 4. Сборка Debug APK через Gradle
cd android
.\gradlew assembleDebug
# Готовый APK лежит в: android/app/build/outputs/apk/debug/app-debug.apk

# 5. Запуск на подключенном смартфоне / эмуляторе
npx cap run android
```

---

## 5. Защитный Чеклист (Anti-Pitfalls)

1. **Относительные пути:** Никаких абсолютных путей `/src/...` или `/manifest.webmanifest`. Все пути строго с точкой: `./src/...`, `./manifest.webmanifest`.
2. **Безопасные отступы (Safe Areas):** Мобильное приложение в Capacitor разворачивается под статус-бар, поэтому CSS-токены `env(safe-area-inset-top)` и `env(safe-area-inset-bottom)` должны иметь минимальный фоллбэк:
   ```css
   padding-top: max(16px, env(safe-area-inset-top));
   padding-bottom: max(16px, env(safe-area-inset-bottom));
   ```
3. **Запрет резиновой прокрутки (Overscroll Bounce):**
   ```css
   html, body {
     overscroll-behavior-y: none;
     -webkit-overflow-scrolling: touch;
   }
   ```
4. **Разблокировка Web Audio Context:** При первом касании пользователя в нативном WebView вызывать `audioCtx.resume()`.
