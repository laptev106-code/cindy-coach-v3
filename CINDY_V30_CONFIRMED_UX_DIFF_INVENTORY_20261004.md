# Точный инвентарь изменений CINDY Coach V3

**Контрольная точка сравнения:** SHA-256 snapshot дерева непосредственно перед этим подтверждённым UX-проходом.  
**Область:** только `/workspace/CINDY_UX_REVIEW_WORK/CINDY_PROJECT`; отдельный ZIP-артефакт указан ниже. Git-репозитория в проекте нет.  
**Назначение:** перечислить каждое изменённое/добавленное дерево-файл и причину; итоговые SHA-256 и взаимные release references перепроверяются release-manifest и отдельной побайтовой сверкой ZIP.

## Изменённые и добавленные файлы

| Путь | Статус | Причина / точное назначение |
|---|---|---|
| `index.html` | Изменён | Единственный прикладной HTML/CSS/JS источник этого прохода: Plan reorder row и exclusions через прежний `userRestrictions`; подписи progress; grouping/disclosure Profile; сохранённые Classic/Pro handlers и `aria-pressed`; команда «Пауза»; итоговый экран с одним ОК; слои основной кнопки Workout и reduced-motion. Никаких изменений Coach Core/session schema. |
| `tests/run_confirmed_ux_dom_tests.cjs` | Новый | End-to-end Chromium DOM regression для подтверждённых interaction paths, существующих storage contracts и видимых состояний. |
| `tests/run_stage5_presentation_tests.cjs` | Изменён | Static assertions исключений в Plan и сохранности Profile contract; проверка обработчиков Classic/Pro и `aria-pressed`. |
| `tests/run_regression_tests.cjs` | Изменён | Новый DOM/runtime suite зарегистрирован как дополнительный master gate; всего 25 gates. |
| `tests/run_release_integrity_tests.cjs` | Изменён | 25-gate count, дополнительные отчётные artifacts, различение фактического Chromium UX-test, независимого QA и ZIP-статуса. |
| `scripts/update_release_manifests.py` | Изменён | 25 gates; отчёт и inventory входят в artifact hashes; отдельно задаётся `--zip-status`; обновлены candidate notes, Chromium evidence и список implementation changes. |
| `RELEASE_INTEGRITY.md` | Изменён | Описана генерация candidate manifests и финальная member-by-member ZIP verification. |
| `RELEASE_NOTES.md` | Изменён | Добавлено dated release note подтверждённого UX-прохода; исторические заметки сохранены ниже. |
| `RELEASE_README.md` | Изменён | Актуализированы процедура проверки, ограничения QA и статус архива. |
| `SHA256SUMS.txt` | Обновлён | Исправлены устаревшие контрольные суммы шести объявленных package-файлов; список теперь сам входит в release artifact hashes и проверяется test gate. |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | Новый | Подробности решений, неизменённые нормативные контракты, `trainingExperience` и результаты тестов. |
| `CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md` | Новый | Этот точный перечень; его собственный итоговый SHA-256 включён в release artifact hashes, но не дублируется внутри себя. |
| `coach_core_v3/coach_integration_v3.js` | Сгенерирован | Только обновлены проектные release source/build literals после изменения HTML/runtime source set; нормативные `V3_SOURCE_HASH`/`V3_BUILD_HASH` остаются закреплёнными за Core. |
| `service-worker.js` | Сгенерирован | Повернут shell cache identity после изменения release source и HTML. |
| `release-manifest.json` | Сгенерирован | Обновлены final artifact hashes, source/build/cache identities, evidence links, ZIP/browser status и 25-gate status. |
| `decomposition-manifest.json` | Сгенерирован | Обновлены release references, gate count, verification state и список implementation changes. |
| `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt` | Обновлён | Пересчитаны перечисленные в нём текущие project-файлы; файл сохранён как отдельная human-readable checksum list. |

**Вне дерева проекта:** `/workspace/CINDY_CoachV3_source.zip` — итоговый исходный архив. Он сверяется по множеству путей, количеству entries и точным байтам каждого файла; ZIP не считается успешным по одному лишь exit code упаковщика.

## Проверяемые release hashes

`release-manifest.json` хранит SHA-256 каждого объявленного runtime/test/process/report artifact, включая `SHA256SUMS.txt` и этот inventory. Два manifest self/cross-references и `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt` не копируются в эту таблицу, чтобы не вводить самоссылочные хэши; оба списковых файла проверяются отдельным release-integrity test. Архив дополнительно проверяется независимо от manifest-claims по каждому файлу.

Список выше сверяется с pre-edit baseline snapshot; случайные временные профили Chromium и вспомогательные скрипты вне project tree не входят в исходный архив и diff inventory.

## Корректирующее дополнение — остаточный point 1 (4 октября 2026)

Предыдущий независимый UX/QA review подтвердил работоспособность reorder, но обнаружил, что `.composition-slot` и `.composition-reorder` всё ещё выглядели как две отдельные соседние поверхности. Текущая корректировка только объединяет их в один внешний `.composition-row` surface; selection/count остаётся основной кнопкой слева, стрелки находятся внутри справа за тонким разделителем, без зазора и номеров позиций.

Новый baseline — точный SHA-256 snapshot непосредственно перед этим исправлением; в проекте нет Git-репозитория. Изменения follow-up фиксируются отдельным списком ниже, чтобы сохранить историю предыдущего UX-прохода:

| Путь | Follow-up изменение |
|---|---|
| `index.html` | Общая поверхность Plan для selector/count и вложенных стрелок; никакие Coach/session/data contracts не менялись. |
| `tests/run_confirmed_ux_dom_tests.cjs` | Chromium DOM assertions общего parent/surface, фактической вложенности, геометрии без gap, доступных labels, disabled boundaries, точного reorder, неизменности `target`/`longGoal` и исключённых упражнений; сохраняется screenshot evidence вне ZIP. |
| `scripts/update_release_manifests.py` | Release metadata отражает точный row-критерий; ZIP-pending gap удаляется после подтверждённого `--zip-status PASS`. |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | Зафиксированы исходный дефект review, исправление, результаты автора и отдельный статус независимого QA. |
| `RELEASE_NOTES.md`, `RELEASE_README.md` | Точное описание одного surface вместо прежней общей формулировки «визуально сгруппированы». |
| Generated release/checksum artifacts | Итоговый `PASS/PASS` зафиксирован в обоих manifests, adapter release literals и service-worker identity; обе checksum lists, manifest self-hashes и cross-references прошли проверку. |

**Вне дерева проекта:** `/workspace/CINDY_UX_REVIEW_WORK/CINDY_POINT1_UNIFIED_ROW.png` — Chromium screenshot; не входит в source ZIP.

## Корректирующее дополнение — точное сохранение `trainingExperience` (4 октября 2026)

Независимый review подтвердил потерю сохранённого значения: позднее одноимённое объявление `normalizeProfile()` перекрывало версию, сохранявшую строку, поэтому `loadConfig()` мог нормализовать её в пустое значение и записать поверх исходных данных. Исправлен только активный Profile normalizer: строковое значение сохраняется без изменений; поле UI остаётся disabled/blank, а сохранение других полей не берёт значение из него. Неподдерживаемые значения по-прежнему нейтрализуются неизменённой Coach-нормализацией; тест сравнивает переданный Coach semantic profile с профилем без значения.

| Путь | Follow-up изменение |
|---|---|
| `index.html` | Активный `normalizeProfile()` сохраняет любую хранимую строку `trainingExperience` точно; нет новых enum, UI-опций, вывода из History или изменений Coach/Core. |
| `tests/run_confirmed_ux_dom_tests.cjs` | Chromium fixture устанавливает непустую opaque-строку до первого boot; проверяет load/normalize, disabled/blank editor и точное сохранение после Profile save. Существующие Plan surface/reorder/boundary/counter/exclusion checks сохранены. |
| `tests/run_real_post_test_browser_lifecycle.cjs` | Runtime fixture доказывает, что неподдерживаемая строка остаётся в Profile, но Coach получает тот же нормализованный semantic profile, что и пустое значение. |
| `tests/run_stage5_presentation_tests.cjs` | Проверяются opaque string preservation, отсутствие enum и disabled/blank редактор без записи пустого UI-значения поверх данных. |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | Добавлены точная причина дефекта, минимальная коррекция, результаты автора и отдельный статус независимой перепроверки. |
| `RELEASE_NOTES.md`, `RELEASE_README.md`, `RELEASE_INTEGRITY.md` | Обновлены заметки кандидата и документирована команда, которая изменяет generated release metadata. |
| Generated release/checksum artifacts | Финальный `PASS/PASS`: оба manifests, adapter release literals, service-worker cache identity и обе checksum lists согласованы; runtime/build hashes проверены на замороженном кандидате. |

**Проверка статуса:** авторские targeted Chromium/presentation/Coach tests прошли; полный master regression — 25/25, нормативный acceptance — 102/102, standalone release integrity — PASS. Независимая перепроверка после исправления не проводилась и не заявляется. Финальный ZIP после продвижения manifest status прошёл member-by-member сравнение всех 105 entries и каждого file byte.

## Итоговое сравнение с входным source ZIP

Исходное дерево сверено с входным `/workspace/CINDY_CoachV3_source.zip` до его замены; SHA-256 входного архива: `7c86e4bbcc2e0d9902db62968a6759564ec7701f528ca565ad98e079684a534d`. В Git-репозитории проекта нет. Совпало множество путей: **85 файлов, 20 каталогов; изменено 17 файлов, добавлено 0, удалено 0**. Полная unified diff сохранена вне дерева проекта: `/workspace/CINDY_UX_REVIEW_WORK/CINDY_COMPLETE_DIFF_VS_INPUT_ZIP_20261004.patch`.

| Изменённый путь относительно входного ZIP | Назначение в итоговом кандидате |
|---|---|
| `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt` | Обновлённая human-readable checksum list. |
| `CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md` | Этот inventory и два corrective follow-up. |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | Итоговые авторские проверки, отдельный QA-статус и границы изменений. |
| `RELEASE_INTEGRITY.md`, `RELEASE_NOTES.md`, `RELEASE_README.md` | Release scope, статусы и mutating metadata-command procedure. |
| `SHA256SUMS.txt` | Точные checksum values для перечисленных packaged files. |
| `coach_core_v3/coach_integration_v3.js`, `service-worker.js` | Генерируемые project-release literals и cache identity; нормативные core-pinned IDs не изменялись. |
| `decomposition-manifest.json`, `release-manifest.json` | Финальные artifact/build hashes, 25-gate и ZIP statuses, self/cross-references. |
| `index.html` | Единая Plan surface; точное сохранение строкового `trainingExperience` активным Profile normalizer. |
| `scripts/update_release_manifests.py` | Генератор release metadata; удаляет устаревший ZIP-PENDING gap только после `--zip-status PASS`. |
| `tests/run_confirmed_ux_dom_tests.cjs` | Chromium проверки Plan composite row/reorder/bounds/counters/exclusions, Profile round-trip и детерминированного light-theme wait. |
| `tests/run_release_integrity_tests.cjs` | Проверка согласованности decomposition ZIP gap с release manifest status. |
| `tests/run_real_post_test_browser_lifecycle.cjs`, `tests/run_stage5_presentation_tests.cjs` | Coach-neutrality regression и Profile presentation/data-contract assertions. |

Финальная сборка исходного ZIP содержит **20 directory entries и 85 file entries**; member/byte сверка финального архива после PASS/PASS metadata generation завершилась **PASS**.

## Корректирующее дополнение — Profile helper под sticky actions (4 октября 2026)

Исходная контрольная точка — точные SHA-256 непосредственно до этого follow-up; полный snapshot 85 файлов сохранён вне проекта: `/workspace/CINDY_UX_REVIEW_WORK/CINDY_PRE_320_HELPER_FIX_SHA256_20261004.txt` (SHA-256 snapshot-файла `c1e76a60f0318c6d72d299d514deeb996d7bb386b6ca02d128b08b08fbcaa5e5`). Git-репозитория нет. При 320×1400 helper геометрически находился в sheet, но пересекался со sticky `#actionButtons` и проваливал foreground hit-test; при 390×1400 четыре строки были выше действий.

| Путь | Follow-up изменение / назначение |
|---|---|
| `index.html` | Только ширина до 430px и только Profile action modal с `#trainingExperienceHelp`: отдельная прокручиваемая `.sheet-body`, вертикальная flex-раскладка и постоянный нескручиваемый ряд действий. Текст/aria relation/disabled-blank и opaque storage preservation не менялись; Coach Core, enum/Matrix и Plan composite не менялись. |
| `tests/run_confirmed_ux_dom_tests.cjs` | Chromium в 320px/390px: точная фраза и 2/4 строки, `aria-describedby`, disabled/blank, полный helper box и строки вне sticky bar, clipping ancestors, `elementsFromPoint()` на каждой строке подтверждает helper на переднем плане и отсутствие кнопок действий в hit stack; все прежние UX/Plan reorder assertions сохранены. |
| `tests/run_stage5_presentation_tests.cjs` | Статическая защита Profile-only media-query/sheet-body scroll separation и сохранности sticky action row. |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | Добавлены новый дефект, baseline-замеры, scoped fix, авторские проверки, ограничения и pre-edit hashes. |
| `CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md` | Это дополнение с точным перечнем follow-up изменений. |
| `coach_core_v3/coach_integration_v3.js`, `service-worker.js` | Generated project-release identity/cache metadata из-за нового HTML/test/report artifact set; pinned normative Core IDs остаются прежними. |
| `release-manifest.json`, `decomposition-manifest.json` | Generated source/build/artifact hashes, self/cross-references и master/acceptance/ZIP candidate statuses. |
| `SHA256SUMS.txt`, `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt` | Пересчитанные packaged-file checksums и manifest cross-references после final metadata generation. |
| `/workspace/CINDY_CoachV3_source.zip` (вне дерева) | Финальная пересборка после итоговой генерации; сравниваются все пути и точные bytes каждого file member. |

Финальные release-gates и ZIP verification фиксируются только после повторного запуска на последнем hash-consistent дереве. Независимый QA на новом exact hash здесь не выполнялся; deployment/publication отсутствуют.


## Корректирующее дополнение — responsive helper `trainingExperience` (4 октября 2026)

Новый baseline — хеши текущего хеш-согласованного кандидата непосредственно перед этим follow-up; список приведён в дополнении к implementation report. Git-репозитория в проекте нет.

| Путь | Follow-up изменение / назначение |
|---|---|
| `index.html` | Утверждённая фраза вынесена из placeholder в видимый helper под disabled/blank input; helper связан через `aria-describedby`; текст заворачивается на узком экране. Opaque Profile round-trip и все Coach/Core/Exercise Matrix контракты сохранены. |
| `tests/run_confirmed_ux_dom_tests.cjs` | Реальные Chromium DOM-проверки 320px/390px: точная фраза, строки полностью видимы, clipping/overflow ancestors, aria relation, disabled/blank поле, сохранение значения; AX tree name/description проверяются строго, если Chromium AX доступен. |
| `tests/run_stage5_presentation_tests.cjs` | Статические проверки точного helper, его отдельного расположения, отсутствия placeholder-копии, disabled/blank состояния и неизменности Coach-normalization boundary. |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | Записаны дефект, точное исправление, результаты targeted tests, независимое review, ограничения и исходные pre-fix hashes. |
| `CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md` | Этот перечень точных follow-up файлов и их причин. |
| `coach_core_v3/coach_integration_v3.js`, `service-worker.js` | Generated project-release literals/cache identity пересчитываются после изменения HTML/runtime source set; normative Core identity не меняется. |
| `release-manifest.json`, `decomposition-manifest.json` | Generated exact artifact/source/build hashes, self/cross references и итоговые master/ZIP statuses. |
| `SHA256SUMS.txt`, `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt` | Пересчитаны packaged и release cross-reference checksum lists после генерации manifests. |

Вне дерева проекта пересобранный `/workspace/CINDY_CoachV3_source.zip` содержит source tree; его путь, SHA-256 и member counts подтверждаются финальной побайтовой сверкой. Дополнительные файлы не создавались; deployment/publication отсутствуют.

**Проверка независимым reviewer:** read-only review post-fix source/test завершён; первый комментарий к условной AX-проверке и недостающей проверке clipping ancestors устранён усилением DOM suite и подтверждён повторным review. Это не заменяет screen-reader, Android/iOS/WebView или release acceptance.
