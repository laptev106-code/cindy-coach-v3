---
name: cindy-coach
description: >
  Полный операционный регламент для разработки CINDY Coach V3.
  Активируй при любой задаче, касающейся этого проекта:
  правки UI, логики коуча, тестов, CSS, модулей, релизных скриптов.
---

# CINDY Coach V3 — Skill разработчика

## 1. Проект в двух словах

**CINDY** — PWA-тренировочный таймер с адаптивным коучем.  
Стек: **Vanilla JS + HTML**, без сборщика, без npm-зависимостей.  
Рантайм: браузер. Запуск через Python HTTP server (`START_CINDY_LITE.bat`, порт 8080).

---

## 2. Карта файлов — что где лежит

```
index.html                        ← ГЛАВНЫЙ файл (3288 строк):
                                     • Весь CSS (~1900 строк инлайн)
                                     • HTML-скелет всех экранов
                                     • 5 inline <script> блоков (workout runtime, UI-логика и т.д.)

src/
  domain/
    exercises/exercise_catalog_v3.js     ← каталог упражнений
    workout/session_contract_v3.js       ← КОНТРАКТ сессии (freeze/sanitize/apply)
    history/history_provenance_v3.js     ← провенанс истории
  application/
    coach/coach_application_service_v3.js   ← сервис коуча
    program/program_service_v3.js            ← сервис программы
    workout/workout_history_service_v3.js    ← сервис истории
  infrastructure/
    browser/feedback_v3.js               ← звук/хаптик
    storage/local_storage_v3.js          ← адаптер localStorage
    storage/repositories_v3.js           ← репозитории (фасад)
    storage/coach_state_repository_v3.js ← состояние коуча
    storage/coach_state_migration_v3.js  ← миграция v2.8→v3
    storage/program_meta_repository_v3.js← мета программы
  presentation/
    components/leaf_components_v3.js     ← листовые компоненты
    navigation/screen_router_v3.js       ← роутер экранов
    navigation/screen_presenter_v3.js    ← презентер
    screens/screen_hosts_v3.js           ← DOM-хосты экранов
  composition/
    bootstrap_v3.js                      ← точка сборки (bind runtime)

coach_core_v3/
  coach_core_v3.js         ← ЯДРО коуча (детерминированный алгоритм)
  coach_integration_v3.js  ← адаптер: Core ↔ Browser runtime
  program_pack_v3.js        ← программа тренировок (4-day rotation)

tests/                      ← 26 Node.js .cjs тестов
scripts/                    ← generate_coach_seed_data, build_seed_coach_html, update_release_manifests.py
```

### Порядок загрузки `<script>` в index.html (строки 1882–3286):
1. `exercise_catalog_v3.js` → `feedback_v3.js` → `local_storage_v3.js` → `repositories_v3.js`
2. `session_contract_v3.js` → `history_provenance_v3.js` → `workout_history_service_v3.js`
3. `leaf_components_v3.js` → `screen_router_v3.js` → `screen_presenter_v3.js` → `screen_hosts_v3.js`
4. Inline `<script>` — основной workout runtime (~строки 1894–2460)
5. Inline скрипты: classic/pro progress, plan format zone runtime
6. **Coach bootstrap** (строки 3278–3286): `coach_core_v3.js` → `coach_state_repository_v3.js` → `coach_state_migration_v3.js` → `program_meta_repository_v3.js` → `coach_application_service_v3.js` → `program_service_v3.js` → `coach_integration_v3.js` → `program_pack_v3.js` → `bootstrap_v3.js`

---

## 3. Глобальное пространство имён (window.*)

Все модули экспортируют себя через `window`:

| Глобал | Файл |
|---|---|
| `window.CindyAdaptiveCoachV3` | coach_core_v3.js |
| `window.CindyCoachIntegration` | coach_integration_v3.js |
| `window.CindyProgramPackV3` | program_pack_v3.js |
| `window.CINDYAppRuntimeV3` | inline script в index.html |
| `window.CINDYSessionContractV3` | session_contract_v3.js |
| `window.CINDYCoachApplicationServiceV3` | coach_application_service_v3.js |
| `window.CINDYProgramServiceV3` | program_service_v3.js |
| `window.CINDYBootstrapV3` | bootstrap_v3.js |

---

## 4. CSS — как устроен дизайн

### Дизайн-токены (CSS-переменные в `:root`)
```css
--paper, --panel, --ink, --muted, --line
--blue (#bd4d2b), --blue-2, --green, --green-ink
--coral, --soft-blue, --soft-green
--shadow, --nav-h (76px), --radius (22px)
```
**Dark mode**: класс `body.dark` переопределяет все токены.

### Правила CSS-правок:
- **Всегда используй токены** (`var(--blue)`) — никогда хардкод цвет.
- CSS находится ТОЛЬКО в `index.html` внутри `<style>` блока (строки 12–815 примерно).
- Существующие анимации: `@keyframes enter`, `orbitDrift`, `orbBreath`, `paceFlow`, `lapRipple`, `sheetRise`, `sessionIgnite` и другие — **не трогай без причины**.
- `@media (prefers-reduced-motion: reduce)` — уже есть, не убирай.

---

## 4.1. Премиальный мобильный UI/UX (Apple HIG / Material 3 / mobile-ui-ux-pro-max)

> **КРИТИЧЕСКИ ВАЖНО:** Приложение должно ощущаться как дорогой нативный продукт из App Store, а не сжатая веб-страница.

### А. Типографика (Zero Micro-Text Policy)
1. **Категорический запрет на кегли 8px, 9px, 10px.** На экранах Retina это нечитаемая «блошиная пыль».
2. **Эталонная мобильная шкала шрифтов:**
   - **Заголовки экранов (Large Title):** `26–30px`, вес 800–900, `letter-spacing: -0.04em`.
   - **Заголовки карточек (Headline):** `18–22px`, вес 700–800.
   - **Основной читаемый текст (Body):** `15–16px`, line-height 1.4–1.5.
   - **Интерактивные кнопки (Buttons):** `14–16px`, вес 700–800, минимальная высота кликабельной зоны `48px`.
   - **Нижняя навигация (`.nav button`):** `12–13px` + иконки `18–20px`.
   - **Бейджи и надзаголовки (`.eyebrow`, капс):** минимум `11–12px` (никогда не меньше 11px!).

### Б. Вкладка «Прогресс» (Анти-информационный шум)
1. **УДАЛИТЬ синтетический мусор:**
   - Блок «Показатели» (псевдонаучные абстракции «Сила 1440 ед.», «Скорость», «Нагрузка/мин», «Ритм пауз», «Регулярность»).
   - Блок «Личные рекорды» (дублирует достижения, показывает нелепости вроде «тренировка 2 часа»).
   - Виджет «Цель 20 кругов» и блок «Динамика».
2. **ОСТАВИТЬ строго два понятных блока:**
   - **Журнал тренировок (История):** дата, время, формат, сколько кругов сделано, какие упражнения.
   - **Достижения (Трофеи):** чёткие понятные майлстоуны («1-я тренировка», «10 тренировок», «50 тренировок», «Клуб 10+ кругов», «Ритм недели»).
3. **Оформление Достижений:**
   - **Строго на плотном белом фоне (`background: var(--panel)`)** в виде карточек `.card`, с мягкой тенью и микро-фаской. Запрещены прозрачные/бесфонные артефакты.

### В. Нативные мобильные анимации (120 FPS Motion)
1. **Bottom Sheet (Выезжающие шторки):**
   - Меню настроек, профиль и редактирование обязаны плавно выезжать снизу:
     `transform: translateY(100%)` → `transform: translateY(0)` с кривой Apple Sheet `cubic-bezier(0.16, 1, 0.3, 1)` длительностью `320–380ms`.
   - Запрещено мгновенное появление/исчезновение (`display: none` без transition).
2. **Анимация переключателей (10 мин / 20 мин / 30 мин):**
   - Сегментированные контролы переключаются плавно, с мягким перетеканием активного состояния (`transition: background 0.22s ease, color 0.2s ease, transform 0.18s ease`).
3. **Тактильный физический отклик (`:active`):**
   - Все кнопки при нажатии пальцем упруго уменьшаются:
     `transform: scale(0.96) translateY(1px); transition: transform 70ms cubic-bezier(0.2, 0, 0, 1);`.

---

## 4.2. Манифест Anti-AI Slop & Тактическая глубина (Спортивный инструмент)

> **Запрет шаблонов AI-slop:** CINDY — это тактический спортивный инструмент для реальных тренировок, а не бездушный концепт из Dribbble.

1. **Запрещены фиолетовые AI-градиенты и неоновые пятна:**
   - Никаких размытых фиолетовых/индиго клякс, псевдо-футуристического неонового свечения и синтетического мусора.
2. **Запрещены плоские безжизненные карточки:**
   - Карточки обязаны иметь осязаемую физическую глубину: многослойные диффузные тени (ambient + directional + contact), фаски и микро-блики (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.2)`).
3. **Запрещены одинаковые шрифты везде:**
   - Заголовочная атлетическая типографика (`Space Grotesk`), сверхинформативный удобочитаемый текст интерфейса (`Manrope`), прецизионные моноширинные таймеры (`DM Mono`).
4. **Запрещен сдвиг таймера (CLS = 0):**
   - Все секундомеры, таймеры кругов и счетчики обязаны использовать `font-variant-numeric: tabular-nums` для предотвращения подергиваний при смене цифр.
5. **Оптическая концентричность скруглений (Concentric Radii):**
   - Внутренний радиус вложенного элемента подчиняется формуле: $R_{\text{inner}} = \max(4\text{px}, R_{\text{outer}} - \text{padding})$. В карточке с `border-radius: 20px` и `padding: 12px` внутренняя кнопка имеет `border-radius: 8px`, а не случайное число.
6. **Эргономика потных рук (Sweaty-Hand Usability):**
   - Минимальная зона клика: 48×48px. Главная кнопка фиксации круга всегда находится в зоне естественного движения большого пальца (Thumb-Zone).

---

## 5. Контракты — НЕЛЬЗЯ НАРУШАТЬ

### Session Contract (`session_contract_v3.js`)
- Поля: `v3Spec`, `v3DecisionNow`, `v3DecisionTimezone`, `v3Ownership`, `v3ContextFingerprint`, `v3Intervention`, `v3SemanticSnapshots`
- API: `freeze()`, `sanitize()`, `apply()`, `clone()` — иммутабельный паттерн
- **Никогда не добавляй поля напрямую** — только через `freeze()`/`apply()`

### Coach Core (`coach_core_v3.js`)
- `SPEC_VERSION = '3.0.0'`, `CORE_VERSION = 'cindy-adaptive-coach-v3.0.0'`
- `EXPECTED_BUILD_HASH` и `EXPECTED_SOURCE_HASH` — хеши защищены тестами
- `DOMAIN.DECISION_MODE`, `SESSION_PURPOSE`, `DECISION_STATUS`, `ADAPTATION_KIND` — перечисления заморожены
- Алгоритм полностью детерминирован — **без случайности, без внешних вызовов**

### Release Integrity
- `run_release_integrity_tests.cjs` проверяет хеши SHA256 всех файлов
- После правки любого файла нужно обновить `SHA256SUMS.txt` через `scripts/update_release_manifests.py`

---

## 6. Тестовая система

### Команды

```powershell
# Полный регрессионный прогон (26 тестов, ~30 сек)
node tests\run_regression_tests.cjs

# Быстрая проверка acceptance (102 кейса)
node tests\run_v3_acceptance_tests.cjs

# Только презентация (Stage 5, быстро)
node tests\run_stage5_presentation_tests.cjs

# Coach логика
node tests\run_coach_cold_start_tests.cjs
node tests\run_coach_migration_tests.cjs

# HTML runtime smoke
node tests\run_final_html_runtime_smoke.cjs
```

### Текущий baseline: **22/26 PASS** (4 теста — инфраструктурные, не баги кода)

**Постоянно падающие тесты (ожидаемо, не фиксить):**
| Тест | Причина |
|---|---|
| `run_confirmed_ux_dom_tests.cjs` | Требует `CHROMIUM_BIN` (нет Chromium) |
| `run_time_baseline_ui_runtime_tests.cjs` | Требует `CHROMIUM_BIN` |
| `run_pace_guidance_dom_runtime_tests.cjs` | Требует `CHROMIUM_BIN` |
| `run_inprocess_e2e.cjs` | E2E, требует браузер |

Если нужен Chromium: `$env:CHROMIUM_BIN = "C:\Path\To\chrome.exe"` перед запуском.  
**Рабочий baseline без Chromium: 22/26 PASS — это норма.**

### Приоритет тестов при правках:
| Тип правки | Обязательные тесты |
|---|---|
| CSS / UI-текст | `run_stage5_presentation_tests.cjs`, `run_confirmed_ux_dom_tests.cjs` |
| Логика коуча | `run_v3_acceptance_tests.cjs`, `run_coach_cold_start_tests.cjs` |
| Хранилище/миграция | `run_coach_migration_tests.cjs`, `run_stage2_repository_tests.cjs` |
| Любой JS-модуль | `run_final_html_runtime_smoke.cjs` |
| Крупная правка | `node tests\run_regression_tests.cjs` (всё) |

---

## 7. Рабочий процесс (обязательный порядок действий)

```
1. ПОНЯТЬ ЗАДАЧУ
   → Прочитать нужные файлы через view_file
   → Определить какой слой затрагивается (domain / application / infra / presentation / index.html)

2. СДЕЛАТЬ ПРАВКУ
   → Хирургический replace_file_content (не переписывать весь файл)
   → CSS: токены, не хардкод
   → JS: сохранить паттерн (IIFE / глобал / freeze)
   → Не менять хеши вручную — это делает скрипт

3. ПРОВЕРИТЬ
   → Запустить минимальный набор тестов для данного типа правки (см. таблицу выше)
   → Если падает — починить СРАЗУ, не оставлять

4. ОТЧИТАТЬСЯ
   → Показать результат тестов
   → Указать файлы и строки которые изменились
```

### 7.1. Superpowers 7-Step Discipline & Инвариант AGENTS.md
В корне проекта находится универсальный манифест `AGENTS.md`. Любые правки проводятся по 7-шаговому циклу:
1. **Бриф и Reality-Check:** Никакого слепого соглашательства — агент отвечает за надежность и эргономику.
2. **Аудит архитектуры:** Проверка слоев Domain/App/Infra/Presentation.
3. **TDD-шлюз:** Тест пишется или проверяется ДО/во время внесения логики.
4. **Хирургическая правка:** Точечный diff без затрагивания несвязанных строк.
5. **Closed-Loop верификация:** Запуск терминальных тестов (exit code 0).
6. **Синхронизация манифеста:** `py scripts/update_release_manifests.py`.
7. **Отчет на человеческом языке:** Результат для атлета на тренировке.

### 7.2. Роевая команда Ruflo (4 роли)
- **Product & UI/UX Designer:** Защита эргономики 2026, Anti-AI Slop, thumb-zone, 48px тапы, концентричность radii, тактильность.
- **Senior Frontend Architect:** Чистый Vanilla JS, отсутствие лишних зависимостей, защита жизненного цикла DOM.
- **SecOps & Data Security Lead:** Защита локальных данных атлета, изоляция токенов GIS в памяти (Pattern C).
- **QA & Verification Engineer:** Контроль 26 тестовых сьютов, baseline 22 PASS, манифест релиза.

---

## 8. Запрещённые паттерны

❌ **Не делать никогда:**
- Добавлять `npm install`, webpack, babel или любой сборщик
- Менять порядок `<script>` тегов в `index.html` без крайней необходимости
- Изменять `EXPECTED_BUILD_HASH` / `EXPECTED_SOURCE_HASH` вручную
- Использовать `document.write()`, `eval()`, инлайн обработчики (`onclick=`)
- Нарушать контракт Session Contract (добавлять поля минуя `freeze()`/`apply()`)
- Делать `coach_core_v3.js` асинхронным или зависимым от внешнего API
- Хардкодить цвета в CSS (только `var(--token)`)
- Менять `PARAM` или `DOMAIN` константы без полного прогона acceptance-тестов

✅ **Всегда делать:**
- Проверять что глобальный объект уже экспортирован перед использованием (`if (!window.X) throw`)
- Использовать `Object.freeze()` для публичного API модулей
- Следовать паттерну модуля: `(function(global){ ... global.X = ...; })(window)`
- Для новых экранов регистрировать их ID в `screen_hosts_v3.js`

---

## 9. Дизайн — конкретные компоненты

| Компонент | Класс | Примечание |
|---|---|---|
| Карточка тренировки | `.practice-card` | Градиент, анимации orb |
| Кнопка круга | `.lap-pad` | Box-shadow 3D эффект |
| Навигация | `.nav`, `.nav-inner` | Fixed, 5 кнопок, backdrop-blur |
| Карточки | `.card`, `.route-card` | Border + panel bg |
| Тосты | `.toast` | Fixed, z-40 |
| Модалы | `.modal` | Backdrop blur + sheet |
| Переключатели | `.switch` + `.slider` | CSS-only toggle |
| Сегментированный выбор | `.segmented` + `.choice` | 2, 3 или 4 колонки |

---

## 10. Быстрые команды

```powershell
# Запустить приложение
.\START_CINDY_LITE.bat

# Полный тест-прогон
node tests\run_regression_tests.cjs

# Acceptance тесты (102 кейса)
node tests\run_v3_acceptance_tests.cjs

# Обновить релизные манифесты (после финальных правок)
py scripts\update_release_manifests.py --regression-status PASS --zip-status PENDING

```
