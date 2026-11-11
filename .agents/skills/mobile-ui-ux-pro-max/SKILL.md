---
name: mobile-ui-ux-pro-max
description: "Высший стандарт мобильного UI/UX дизайна, вёрстки и интерактивности (Apple HIG, Google Material 3, Thumb-Zone эргономика, Safe Area Insets, предотвращение сдвигов виртуальной клавиатурой, тактильный 3D-отклик, 120 FPS GPU-анимации, цветовые пространства и WCAG 2.2 AA). Активируется при любых задачах по мобильному дизайну, верстке, интерфейсам, кнопкам, формам, шторкам, жестам или фразах 'дизайн', 'ui', 'ux', 'мобильный интерфейс', 'эргономика', @mobile-ui-ux-pro-max."
---

# Mobile UI/UX Pro Max: Индустриальный Стандарт Мобильного Опыта

Синтез эталонных мировых стандартов мобильного проектирования (**Apple Human Interface Guidelines**, **Google Material Design 3**, рекомендаций **Addy Osmani / Google Chrome Team**) с нашими проверенными принципами физической тактильности, 120 FPS анимаций и защищённой нативной эстетики без веб-артефактов.

---

## 1. Иерархия Приоритетов (Priority Pyramid)

Каждое интерфейсное решение проходит обязательный фильтр от критического к эстетическому:

| Приоритет | Категория | Влияние | Ключевые требования | Антипаттерны (Строго запрещено) |
|---|---|---|---|---|
| **P1** | **Accessibility & Contrast** | Критическое | Контраст текста ≥ 4.5:1 (WCAG AA), `aria-label` для иконок без текста, чёткие фокусные кольца. | Серый текст на сером фоне, кнопки без текстовых подписей для скринридеров. |
| **P2** | **Touch & Thumb-Zone** | Критическое | Размер хитбокса ≥ **48×48px**, зазор между элементами ≥ **8px**, ключевые CTA в нижней половине экрана. | Мелкие кликабельные крестики (16–24px), скученные ссылки, требующие зума. |
| **P3** | **Safe Area & Viewport** | Критическое | Учёт `env(safe-area-inset-*)`, высоты `100dvh`/`100svh`, корректное поведение при экранной клавиатуре. | Перекрытие кнопок домашней полоской iPhone или «чёлкой», скачки вёрстки. |
| **P4** | **Zero-CLS & Performance** | Высокое | Фиксация соотношений сторон (`aspect-ratio`), скелетоны, отсутствие прыжков вёрстки (CLS < 0.05). | Подгрузка картинок без зарезервированного места, дергающаяся лента. |
| **P5** | **Tactile 3D Depth** | Среднее | Физический объём, микро-фаски (`inset 0 1px 0 rgba(...)`), пружинящее вдавливание `:active`. | Плоский безжизненный дизайн 2015 года, размытые грязные тени. |
| **P6** | **120 FPS Motion** | Среднее | Анимации **только** через `transform` и `opacity`, учёт `prefers-reduced-motion`. | Анимация `height`, `top`, `margin`, `padding` (вызывает Reflow/Lag). |

---

## 2. Мобильная Геометрия и Эргономика «Зоны Большого Пальца»

### А. Эргономика Thumb-Zone (Одноручный хват)
1. **Нижний ярус действия (Natural Zone):**
   - Все частые действия (навигационные табы, кнопка создания `+`, фильтры категорий, первичные кнопки в модалках «Сохранить», «Готово») располагаются в нижних 40–50% экрана.
2. **Верхний ярус (Read-Only / Header):**
   - Верхняя часть экрана предназначена для статусной информации, заголовков экранов, общего прогресса и аватаров. Там не должно быть мелких обязательных кнопок.
3. **Хитбоксы и кликабельность:**
   - Если визуальный размер иконки 20×20px или 24×24px, её CSS-контейнер (`padding`, `min-width`, `min-height`) **обязан быть не менее 44×44px (iOS) / 48×48px (Android)**.

### Б. Safe Area Insets (Островки, вырезы, домашняя полоса)
Любой фиксированный нижний бар (`.bottom-nav`), модальное окно или плавающая кнопка обязаны учитывать системные отступы:
```css
/* Эталонный паддинг нижнего бара */
.bottom-nav {
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  padding-left: calc(12px + env(safe-area-inset-left, 0px));
  padding-right: calc(12px + env(safe-area-inset-right, 0px));
}

/* Верхняя шторка */
.header-safe {
  padding-top: calc(8px + env(safe-area-inset-top, 0px));
}
```

---

## 3. Мобильная Виртуальная Клавиатура и Динамический Viewport

При появлении экранной клавиатуры на смартфонах браузер сжимает область просмотра, что часто ломает модальные окна и перекрывает поля ввода.

### Правила защиты от сбоев клавиатуры:
1. **Динамические единицы высоты (dvh / svh):**
   - Всегда использовать `min-height: 100dvh` (Dynamic Viewport Height) вместо устаревшего `100vh`.
2. **Метатег Viewport для современных WebView:**
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content">
   ```
   Атрибут `interactive-widget=resizes-content` сообщает браузеру пересчитывать viewport плавно.
3. **Scroll-Padding для форм в модалках:**
   ```css
   .sheet, .modal-scroll-area {
     scroll-padding-bottom: 120px;
     overscroll-behavior: contain;
     -webkit-overflow-scrolling: touch;
   }
   ```
4. **VisualViewport Focus Sync (JavaScript):**
   При фокусе в поле ввода (`input`, `textarea`) активное поле должно гарантированно оставаться в видимой зоне:
   ```javascript
   window.visualViewport?.addEventListener('resize', () => {
     const active = document.activeElement;
     if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
       active.scrollIntoView({ block: 'center', behavior: 'smooth' });
     }
   });
   ```

---

## 4. Тактильный 3D-Объём, Цветовая Гармония и Защитная Вёрстка (Physical UI & Defensive Layout)

Интерфейс не должен выглядеть как плоская веб-страничка. Он обязан ощущаться как **дорогое тактильное устройство**:

### А. Архитектура Световых Фасок и Многослойных Теней
- **Микро-блик сверху (Top Rim Light):** `inset 0 1px 0 rgba(255, 255, 255, 0.15)` в темной теме или `inset 0 1px 0 rgba(255, 255, 255, 0.8)` в светлой теме создает ощущение физической грани стекла или керамики.
- **Диффузная 3-слойная тень (Layered Elevation):**
  ```css
  /* Уровень 2: Карточки и кнопки */
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    0 1px 2px rgba(40, 43, 39, 0.04),
    0 4px 10px -2px rgba(40, 43, 39, 0.08),
    0 12px 24px -4px rgba(40, 43, 39, 0.07);
  ```
- **Пружинящий отклик `:active`:**
  ```css
  .button-tactile:active, .cat-chip:active {
    transform: scale(0.96) translateY(1px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    transition: transform 70ms cubic-bezier(0.2, 0, 0, 1), box-shadow 70ms ease;
  }
  ```

### Б. Защитная Вёрстка Без Наездов и Коллизий (Defensive CSS)
1. **Никаких фиксированных высот `height` для блоков с текстом:** Строго `min-height: 48px; height: auto;` для защиты от переполнения при переносе строк.
2. **Изоляция иконок и бейджей:** Обязательный `flex-shrink: 0` на всех иконках, чекбоксах и статусных бейджах.
3. **Защита flex-колонок от вылетания:** `min-width: 0; overflow-wrap: anywhere;` на текстовых контейнерах.
4. **Концентрические радиусы скругления:** Вложенные радиусы подчиняются закону $R_{inner} = \max(4px, R_{outer} - Padding)$.

### В. Цветовые пространства, аура и темы
- Использование `color-mix(in srgb, var(--primary) 15%, transparent)` для деликатных подложек бейджей.
- **Фоновая аура темы:** Мягкие радиальные градиенты на фоне вместо примитивных сплошных заливок или неровных тайловых паттернов:
  ```css
  background: 
    radial-gradient(110% 85% at 5% 5%, color-mix(in srgb, var(--theme-accent) 12%, transparent) 0%, transparent 55%),
    radial-gradient(90% 70% at 95% 95%, color-mix(in srgb, var(--theme-secondary) 10%, transparent) 0%, transparent 60%),
    linear-gradient(180deg, var(--paper) 0%, color-mix(in srgb, var(--paper) 90%, var(--theme-accent)) 100%);
  ```
- **Палитра «На двоих»:**
  - *Duo Denim (Основная):* Глубокий индиго `#1c2738` / `#22334a`, акцентный циан `#38bdf8`, золотисто-кремовые бейджи.
  - *Warm Sage (Шалфей):* Натуральный оливково-шалфейный `#3a5a40` / `#588157`, кремовый фон.
  - *Terracotta / Peach:* Тёплый глиняный акцент `#e07a5f` для романтических и парных акцентов.
- **Синхронизация шторки:** При переключении темы обязателен апдейт `<meta name="theme-color">`, чтобы строка состояния смартфона бесшовно сливалась с фоном экрана.

---

## 5. Высокопроизводительные Анимации (60–120 FPS Motion)

1. **Аппаратное ускорение (GPU-Only Rule):**
   - **РАЗРЕШЕНО анимировать ТОЛЬКО:** `transform` (translate, scale, rotate) и `opacity`.
   - **СТРОГО ЗАПРЕЩЕНО анимировать:** `width`, `height`, `margin`, `padding`, `top`, `bottom`, `left`, `right`.
2. **Физические кривые (Spring & Ease):**
   - Плавное открытие модалок и шторок: `cubic-bezier(0.16, 1, 0.3, 1)` (стандарт Apple iOS Sheet).
   - Длительность микровзаимодействий: **140–220ms**. Запрещены медленные тягучие анимации >350ms, создающие ощущение «тормозов».
3. **Уважение настроек пользователя (Reduced Motion):**
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

---

## 6. Нативный Мобильный Опыт (Anti-Web Feel)

Приложение в браузере или Telegram Mini App должно ощущаться неотличимым от нативного приложения из App Store:

1. **Запрет случайных браузерных жестов:**
   ```css
   /* Блокировка pull-to-refresh браузера там, где он не нужен, и горизонтального свайпа истории */
   body {
     overscroll-behavior-y: none;
     -webkit-touch-callout: none;
     -webkit-tap-highlight-color: transparent;
     user-select: none;
     touch-action: pan-y;
   }
   ```
2. **Контрастный системный фокус:**
   Никаких синих браузерных рамок по умолчанию. Все фокусы кастомизируются через `:focus-visible` мягким светящимся контуром `0 0 0 3px color-mix(in srgb, var(--primary) 35%, transparent)`.
3. **Тактильный вибро-отклик (Haptic Feedback):**
   При выполнении ключевых действий (отметка задачи «Сбылось», сохранение фото, подтверждение шага) вызывать деликатный тактильный отклик:
   ```javascript
   function triggerHaptic(type = 'light') {
     if (window.Telegram?.WebApp?.HapticFeedback) {
       if (type === 'success') window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
       else window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
     } else if (navigator.vibrate) {
       navigator.vibrate(type === 'success' ? [15, 40, 20] : 10);
     }
   }
   ```

---

## 7. Чек-лист Мобильного Аудита Перед Сдачей Работы

Перед отправкой любых изменений в интерфейс инженер обязан проверить:
- [ ] Кликабельные зоны всех кнопок и иконок не менее **48×48px**?
- [ ] Учтены ли отступы `env(safe-area-inset-bottom)` для нижнего бара и модалок?
- [ ] Нет ли горизонтального скролла (`overflow-x: hidden` на корзинах и контейнерах)?
- [ ] При открытии экранной клавиатуры форма остаётся доступной и поля не перекрываются?
- [ ] Анимируются только `transform` и `opacity` (анимации работают с частотой до 120 FPS)?
- [ ] Контраст текста удовлетворяет стандарту WCAG 2.2 AA (минимум 4.5:1)?
- [ ] Нет ли мерцания шрифтов или скачков вёрстки при загрузке картинок (CLS = 0)?
- [ ] Присутствует ли физический отклик `:active` при тапе?
