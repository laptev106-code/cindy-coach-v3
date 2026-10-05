# CINDY Coach V3 — отчёт о подтверждённом UX-проходе

**Дата:** 4 октября 2026 года  
**Проект:** `/workspace/CINDY_UX_REVIEW_WORK/CINDY_PROJECT`  
**Объём:** только изменения, подтверждённые пользователем для существующего CINDY Coach V3; Core и контракт тренировки не менялись.  
**Публикация/деплой:** не выполнялись.

## Что реализовано

### Список упражнений в Плане

- Название/выбор упражнения и счётчик занимают основную ширину одной общей поверхности на каждый пункт; стрелки вверх/вниз физически находятся внутри этой поверхности справа за тонким разделителем, без зазора и без номеров позиций.
- Счётчики целей Плана (`target`, `longGoal`) не связаны с этими стрелками и не изменяются перестановкой.
- Исключения упражнений редактируются в самом composer Плана, а не дублируются в редакторе Профиля. Используется существующий контракт `userRestrictions.excludedExerciseIds`; нового поля конфигурации не добавлено. Исключённые упражнения остаются видимыми и помеченными, но недоступны для добавления, включая соответствующие варианты; попытка сохранить запрещённый выбор дополнительно блокируется.

### Прогресс и настройки Профиля

- Техническую подпись «Режим развития» заменил текст **«Ваш прогресс по мере тренировок»** с короткой поясняющей подписью. Идентификатор и семантика прежнего переключателя `profile.developmentView` сохранены.
- Фильтры **7 дней / 28 дней / всё время** остаются доступными и независимыми от выключения этого переключателя; это отдельный выбор периода для аналитики, а не часть режима отображения.
- Поля Профиля визуально сгруппированы под заголовком «ЛИЧНЫЕ ДАННЫЕ». Устаревший дубль списка исключений из Profile editor удалён; допустимые equipment/family restriction-поля и правила сохранения ограничений не переопределялись.
- Разделы настроек открываются по явному нажатию/клавиатурной активации. У раскрытого раздела остаётся направленный вниз индикатор, чёрный на светлой теме. Прокрутка к деталям плавная при обычном режиме и без анимации при `prefers-reduced-motion: reduce`.

### Classic/Pro и звук

- Кнопки **КЛАССИКА / ПРО** подключены к имеющемуся сохранению `experienceMode`; `aria-pressed` и выбранное состояние синхронизируются с текущей настройкой после загрузки и смены режима.
- Существующее звуковое управление остаётся доступным и сохраняется в Pro. Новый отдельный переключатель звука или альтернативный storage key не вводился.

### Голосовая команда и итог тренировки

- К распознаванию добавлена команда **«Пауза»**: при активной тренировке она вызывает существующий `pause()` и переводит сессию в штатное paused-состояние. Команда **«Круг»** продолжает вызывать прежнее добавление круга (`addLap()`). Тест использует подмену Web Speech API и проверяет маршрут команд; качество распознавания микрофоном не оценивалось.
- В итоговом окне оставлена одна кнопка **«ОК»**, которая сбрасывает итоговый экран и возвращает на Workout. Журнал/Progress остаётся отдельным экраном и не объединяется с результатом.

### Кнопка Workout и шрифты

- Для основного действия Workout заданы различимые уровни объёмной тени в состояниях готовности и активной тренировки, отдельная более прижатая тень на нажатии и плавный возврат в обычном режиме.
- При `prefers-reduced-motion: reduce` длительности переходов сокращаются. Результат действия и маршрут тренировки не изменялись.
- Для заголовков использован уже существующий стек проекта (`Space Grotesk`, `Manrope`, `Inter` и системные fallbacks); новые шрифты и внешние зависимости не добавлялись.

## `trainingExperience` и границы Exercise Matrix

Поле `trainingExperience` сохранено без переименования, новых enum-значений и новых вариантов UI. Оно остаётся недоступным для редактирования, поскольку normative specification не определяет утверждённый allow-list. Исправлена подтверждённая потеря: позднее одноимённое объявление `normalizeProfile()` затеняло нормализатор, сохранявший строку, и при загрузке могло записать пустое значение поверх хранимого. Активный нормализатор теперь сохраняет строку точно; disabled/blank поле редактора Profile не записывается поверх неё при сохранении других полей.

Спецификация, §E1 (строка Experience в таблице profile effects), разрешает учитывать опыт **только если Exercise Matrix явно называет его в `coachEligibility`**; это может ограничить допустимость рекомендации. Общего эффекта на confidence/сопоставимость или прямого множителя нагрузки для опыта не задано. Exercise Matrix описывает семантику и eligibility вариантов; это не основание изобретать числовую шкалу опыта. Сохранённая строка остаётся opaque Profile-данными: неподдерживаемое значение нормализуется до пустого на границе Coach и даёт тот же semantic profile, что отсутствие значения. Coach logic не менялась.

## Проверки

| Проверка | Результат |
|---|---|
| `node tests/run_confirmed_ux_dom_tests.cjs` | PASS: Chromium DOM-пути настроек, Pro persistence, независимых периодов, Profile, Plan exclusions/reorder (общий surface, вложенные стрелки, labels/boundaries, counters unchanged), голосовых команд и результата |
| `node tests/run_stage5_presentation_tests.cjs` | PASS, 19/19 assertions |
| `node tests/run_coach_preference_tests.cjs` и invalid-experience fixture | PASS: opaque Profile round-trip и Coach semantic neutrality |
| `node tests/run_pace_guidance_dom_runtime_tests.cjs` | PASS |
| Синтаксис всех inline JS-блоков `index.html` | PASS, 5 блоков |
| `node tests/run_regression_tests.cjs` | PASS, 25/25 gates, включая нормативный acceptance 102/102 для hash-consistent кандидата |
| `node tests/run_release_integrity_tests.cjs` | PASS: 63 artifact hashes, обе checksum lists, обе manifest self-hashes и cross-references |
| Проверка финального source ZIP по каждому пути/байтам | PASS: 20 directory + 85 file members; все пути и байты совпали с финальным деревом после PASS/PASS metadata generation |

Chromium был запущен локально с отдельным временным профилем, без внешней публикации. Авторские проверки не являются независимым QA; Android/iOS и встроенные WebView не проверялись.

## Не менялось

- нормативная Exercise Matrix, Coach Core, scoring/decisions, `WorkoutSpec` и runtime-контракт сессии;
- поля счётчиков Плана, история пользователя, значения и смысл `trainingExperience`;
- пользовательские данные, интеграции, deployment или опубликованный сайт.

**Отчёт и точный перечень изменённых файлов:** [CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md](CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md).

## Дополнение: точечное исправление единой поверхности Plan

**Подтверждённый дефект:** независимый UX/QA review подтвердил, что перестановка работала, но `.composition-slot` и `.composition-reorder` визуально оставались раздельными соседними поверхностями. Поэтому утверждение предыдущего прохода о визуальном объединении уточнено: единая строка сама по себе не удовлетворяла критерию общей поверхности.

**Исправление:** внешний `.composition-row` теперь является общей непрерывной поверхностью каждого упражнения. Кнопка выбора с названием и счётчиком занимает основную ширину; стрелки вверх/вниз находятся внутри того же родителя справа, между ними — только тонкий разделитель. Видимого зазора и номеров позиций нет. Сохранены существующие `aria-label` с именем упражнения и направлением, блокировка стрелки вверх для первого и вниз для последнего элемента, изменение только порядка `config.composition`, неизменность `target`/`longGoal`, видимость/красная маркировка/отключение исключённых элементов и контракт `userRestrictions`.

**Результаты автора для исправленного кандидата:** targeted Chromium UX DOM suite — PASS; DOM-проверки подтверждают общего родителя/поверхность, вложенность стрелок, геометрическое прилегание без gap, подписи, граничные disabled-состояния, точную перестановку состава и неизменность счётчиков. Скриншот Chromium: `../CINDY_POINT1_UNIFIED_ROW.png`. Stage 5 presentation suite — 19/19 PASS. Полный 25-gate regression — 25/25 PASS, включая acceptance 102/102; standalone release integrity — PASS. Финальный source ZIP совпал по всем 105 members после статуса `PASS/PASS`.

**Независимый QA:** review является источником найденного дефекта; повторная независимая проверка после исправления здесь не выполнялась и не заявляется. Android/iOS/WebView также не проверялись.

## Дополнение: сохранение opaque `trainingExperience`

Независимый review дополнительно подтвердил дефект сохранения Profile: позднее одноимённое объявление `normalizeProfile()` затеняло прежнюю реализацию, поэтому загрузка могла отбросить строку и записать нормализованный пустой профиль. Исправлен активный нормализатор: любая строка сохраняется без изменений; поле опыта остаётся disabled и пустым в редакторе, а сохранение остальных полей не использует его пустое UI-значение.

**Авторские проверки:** Chromium тестирует сохранённое до первого boot непустое неизвестное значение, exact load/save round-trip и disabled/blank UI. Runtime fixture проверяет, что неизвестное значение остаётся в Profile, но передаётся Coach как пустое и даёт тот же semantic profile, что пустое значение. Presentation assertion подтверждает отсутствие новых enum/вариантов UI. Полный мастер-проход прошёл 25/25, включая acceptance 102/102; release integrity прошёл. Coach/Core, History inference, нормативная Matrix и scoring не менялись.

Найденный независимым review дефект после исправления отдельно им не перепроверялся; авторские результаты не выдаются за independent QA. В одном промежуточном полном прогоне 24/25 была нестабильной проверка цвета chevron с фиксированной задержкой; тест теперь ждёт выбранную светлую тему и окончательный computed color. CSS и продуктовое поведение не менялись; последующий полный прогон прошёл 25/25.


## Дополнение: адаптивное объяснение `trainingExperience` (4 октября 2026)

**Подтверждённый дефект:** подпись пояснения находилась в placeholder disabled-поля и обрезалась на ширинах 320px и 390px.

**Точечное исправление:** ровно утверждённый текст `Варианты выбора пока не заданы в нормативной спецификации.` теперь размещён видимым отдельным текстовым блоком непосредственно под полем; это не placeholder. Для disabled input задан `aria-describedby="trainingExperienceHelp"`. Поле остаётся disabled и пустым; существующая строка `profile.trainingExperience` по-прежнему сохраняется opaque без изменений. Новые enum/варианты, вывод из истории, правила eligibility и иная семантика Coach/Core/Exercise Matrix не добавлялись.

**Авторская Chromium-проверка:** `node tests/run_confirmed_ux_dom_tests.cjs` — `CONFIRMED_UX_DOM_TESTS_PASS`. Для viewport 320px helper отрисовался в 2 строки, для 390px — в 4; полный текст видим. DOM suite проверяет точный текст, порядок непосредственно под полем, `aria-describedby`, disabled/blank value, геометрию строк, viewport bounds, размеры scroll/client, ellipsis/line-clamp и предков с overflow/clip-path. Chromium `Accessibility.getFullAXTree` также вернул имя `ОПЫТ ТРЕНИРОВОК` и точное описание helper. Это проверка accessibility tree, **не реальная проверка программой экранного доступа**. `node tests/run_stage5_presentation_tests.cjs` — `PASS`, 19/19.

**Независимая проверка:** отдельный read-only reviewer проверил post-fix источник и тесты и повторно запускал targeted suite и Stage 5. Дефектов реализации не найдено. По замечаниям первого прохода тест был усилен: если Chromium AX tree доступен, отсутствие textbox/имени/описания теперь завершает тест ошибкой; wrapped text дополнительно сверяется с clipping ancestors. Повторный независимый просмотр подтвердил закрытие обоих замечаний. Это независимый код/тест review, **не release acceptance**.

**Ограничения:** настоящий screen reader не запускался; Android/iOS и встроенные WebView не проверялись. Deployment/publication не выполнялись. Итоги полного master/regression и финальной ZIP-проверки должны читаться только из итогового хеш-согласованного кандидата; этот раздел не объявляет их результат заранее.

### Последние зафиксированные SHA-256 до этого исправления

| Артефакт до правки | SHA-256 |
|---|---|
| `index.html` | `1edafc993ab230ec19bf2b671781d0fdeea23a371cfb9df959b9917dc9c2c4f5` |
| `tests/run_confirmed_ux_dom_tests.cjs` | `b8b4625eb72643a7bafad99a4607a8db1379d83cc1c3c6b0e32e835a847e100a` |
| `tests/run_stage5_presentation_tests.cjs` | `9e398a9d0042196a4ccf6fc87d99b3cd6f634a44ae68bc9862e9fa626e8e7fc9` |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | `fdc15bd1048d6d837f75a781361a7820fcc649a72eb4824e1f4c1d0bf857239a` |
| `CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md` | `fa731a95fe22a305e309938fdb8db59bd1b731e0cce062e8cc358ad05cce014a` |
| `SHA256SUMS.txt` | `4b0ef9a5117bd27f64c152f22ed9a3396ebada233c6efb789711d1ade00bb570` |
| `release-manifest.json` exact file / normalized self-hash | `b3073c224691c95e609627df28c9b6beb336dabd53b12aab2b4990adb72ef9ea` / `df1278dd916abb1916dbd60ff5788382e9656dffbc8f31aea391906692f55cd5` |
| `decomposition-manifest.json` exact file / normalized self-hash | `9506b379a4b51d91313aef69bb6aed694b8bdfbcd50815b612a09875ea456a6f` / `321e2d067ce9589a5b2c8994cf619d78e3bc9356c775aac3198036027983419e` |
| `/workspace/CINDY_CoachV3_source.zip` | `79d43bd6b54226b1ddbe91c66eb251f682a21e1cd652cf66860ba2720b884e49` |

Финальные хеши generated manifest и ZIP выводятся в передаче результата, а не в этом включённом в пакет отчёте: сам отчёт входит в `artifactHashes`, поэтому помещение сюда точного собственного итогового manifest/ZIP digest создало бы цикл самоссылки.


### Результаты полного цикла до promotion ZIP-status

На кандидате с release status `PENDING/PENDING` первый `node tests/run_regression_tests.cjs` завершился `FAIL` (23/25): checksum cross-reference manifest-файлов был обновлён до повторной генерации manifests и стал устаревшим. После обновления cross-reference list **после последней записи manifests** `node tests/run_release_integrity_tests.cjs` завершился `PASS`, а последующий `node tests/run_regression_tests.cjs` — `PASS`, 25/25 gates. Отдельная `node tests/run_v3_acceptance_tests.cjs` завершилась `PASS`, 102/102 fixtures. Черновой source ZIP этого промежуточного кандидата прошёл member/byte comparison: 20 directory + 85 file entries (105 всего). Этот промежуточный архив не является финальной поставкой; после обновления отчёта и финальных generated statuses архив будет пересобран и проверен заново.

## Дополнение: helper Profile не перекрывается липкими действиями (4 октября 2026)

**Новый подтверждённый дефект:** прежняя responsive-проверка удостоверяла границы viewport и clipping, но не проверяла перекрытие sticky footer. На исходном candidate при 320×1400 helper имел геометрию `y=1211.39…1242.17`, тогда как строка действий начиналась на `y=1211` и заканчивалась на `y=1277`; `elementsFromPoint()` в местах текста возвращал «ОТМЕНА»/`#actionButtons`, поэтому пояснение фактически нельзя было прочесть. При 390×1400 четыре строки находились выше панели. Это отдельное исправление после ранее вынесенного helper из placeholder.

**Точечное исправление:** только до 430px и только у `#actionModal`, содержащего `#trainingExperienceHelp`, action sheet становится вертикальным flex-контейнером. `.sheet-body` получает собственную прокрутку и может сжиматься (`min-height:0`); ряд действий остаётся липким и занимает отдельную нескручиваемую область внизу. Helper и кнопки больше не делят перекрывающуюся scroll-поверхность. Другие action/result dialogs и desktop layout селектором не меняются.

Точный текст **«Варианты выбора пока не заданы в нормативной спецификации.»**, его расположение под полем и `aria-describedby="trainingExperienceHelp"` сохранены. `trainingExperience` остаётся disabled и пуст в UI; сохранённая строка остаётся opaque и не перезаписывается при Profile save. Новые enum/options, правила Coach/Exercise Matrix, Core/session/Plan-семантика не добавлялись; общий Plan reorder composite и счётчики не изменялись.

**Авторские проверки:** `node tests/run_confirmed_ux_dom_tests.cjs` — PASS. Chromium сохраняет 2 строки при 320px и 4 при 390px; проверяет точный текст, disabled/blank control и `aria-describedby`, отсутствие пересечения полного helper-бокса и каждой строки со sticky action bar, clipping ancestors и foreground `elementsFromPoint()` для каждой строки (helper сверху, action row и её кнопки отсутствуют в hit stack). AX tree по-прежнему обязан содержать точное description. Предыдущие assertions Plan общей поверхности/перестановки/границ/неизменности counter также прошли. `node tests/run_stage5_presentation_tests.cjs` — PASS, 19/19; добавлен static guard на узкую Profile-only область. Это авторские результаты, не независимый QA.

### Хеши непосредственно до этого follow-up

| Артефакт | Pre-edit SHA-256 |
|---|---|
| `index.html` | `74ddf61f1d6872dd54e7b9028b70400fbd83d4ab321f1ea9bccd83bb025e9b6c` |
| `tests/run_confirmed_ux_dom_tests.cjs` | `0c063123dfe568b6b441ade9cfccbbf04ca8d15b87854838ecc444569587b5d2` |
| `tests/run_stage5_presentation_tests.cjs` | `a29a8cdd2870359b53e712b829fd94de67ba54f8fc31584280c7fb4029a1d3a8` |
| `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md` | `f63c8bed85ff04708a5c172374d5ce023dc20da16c8adeb393f00674c0963cbf` |
| `CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md` | `41f8581b1f70cf698ea107af07ef5ffbd2f614415f0378979e10421393ab5638` |
| `SHA256SUMS.txt` | `299d9712594c8040739acfdee09e900d5c544f86b733246a830ef4c0c5042d8c` |
| `release-manifest.json` / `decomposition-manifest.json` | `768d365a67182bf7d3e17262b8bd959f73ec920b0e68811c74ca4dc414b500d6` / `cb17c366512536f75c19b5e4ead0f7cdeb076dd74fb366210aa078f314c5ca94` |
| Исходный `/workspace/CINDY_CoachV3_source.zip` | `47ff2f8a1e60fcef828a38fa5838eabcaa1fc8f1028912c0071138b702785b9a` |

Полный pre-edit snapshot 85 файлов: `/workspace/CINDY_UX_REVIEW_WORK/CINDY_PRE_320_HELPER_FIX_SHA256_20261004.txt` (SHA-256 самого snapshot-файла `c1e76a60f0318c6d72d299d514deeb996d7bb386b6ca02d128b08b08fbcaa5e5`). Независимый final QA после этого исправления здесь не выполнялся и не заявляется; новый exact candidate предназначен для повторной независимой проверки. Android/iOS/WebView и настоящий screen reader не проверялись. Deployment/publication не выполнялись.

**Финальная проверка этого exact candidate:** после последнего изменения отчёта выполнены targeted Chromium UX suite — PASS; Stage 5 — PASS, 19/19; master regression — PASS, 25/25; отдельный V3 acceptance — PASS, 102/102; standalone release integrity — PASS, все 63 объявленных artifact hashes и обе checksum lists. Финальный source ZIP — PASS: 20 каталогов + 85 файлов; все 105 путей совпали, все файлы после извлечения совпали с деревом побайтно и по SHA-256. Generated manifests фиксируют `PASS/PASS`. Это авторские проверки, не независимый final QA; нового hash QA предстоит повторно проверить отдельно. Deployment/publication не выполнялись.
