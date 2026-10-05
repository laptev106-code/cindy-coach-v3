# CINDY V3 — Decomposition Stage 2

## Цель
Stage 2 переводит четыре persistence aggregate в явные repository boundaries, не вынимая пока lifecycle Workout/History и не меняя Coach core/integration contract.

## Что вынесено
- `src/infrastructure/storage/repositories_v3.js`
  - `ConfigRepository`
  - `SessionRepository`
  - `HistoryRepository`
  - `CloudRepository`
  - capture/restore
  - multi-aggregate transaction with rollback

## Что реально подключено к приложению
- `loadConfig()` / `saveConfig()` → ConfigRepository
- `loadSession()` / `saveSession()` / `clearSession()` → SessionRepository
- `records()` / `saveHistory()` / clear-history action → HistoryRepository
- `loadCloud()` / `saveCloud()` → CloudRepository
- Google snapshot application → repository transaction

## Что намеренно НЕ трогалось
- `normalizeConfig`, `normalizeSession`, `normalizeRecord`
- Active Workout lifecycle
- History domain calculations/UI
- V3 Coach Core
- V3 Coach Integration lifecycle wrappers
- `renderAll` / navigation
- embedded V2.8 compatibility layer
- Program Pack behavior

## Контракт Stage 2
Репозитории отвечают за persistence I/O. Нормализация и domain semantics пока остаются в application runtime. Это переходный этап, а не финальная архитектура.

## Проверки
- Stage 2 static: PASS
- repository round-trip: PASS
- transaction rollback: PASS
- Stage 1 regression: 8/8 PASS
- V3 acceptance: 100/100 PASS
- 4-day program: PASS
- integration E2E: PASS

## Важное
Исходный Stage 1 bundle не изменялся. V3 core/integration/program pack hashes сохранены. Browser-rendered UI/Android QA в этом этапе не заявляются как выполненные.
