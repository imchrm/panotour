# TODO.md — panotour

> Живой список задач. `[ ]` -> `[x]` по мере выполнения.
> Перемещай выполненные задачи в CHANGELOG.md.

---

## Срочно (MVP — полный цикл)

### Инфраструктура
- [x] Создать root `package.json` с `workspaces: ["packages/*"]`
- [x] Создать `.gitignore` (node_modules, dist, *.tgz, .DS_Store)
- [x] Создать `README.md` с инструкцией запуска

### Пакет `tiler`
- [x] Инициализировать `packages/tiler/package.json`
- [x] Реализовать `tiler.js` CLI (аргументы: --input, --output, --id)
- [x] Реализовать `lib/cubemapTiler.js` — обратная проекция + sharp (без panorama-to-cubemap)
- [x] Реализовать `lib/manifest.js` — генерация `manifest.json` с levels[]
- [x] Добавить флаг `--mobile` — генерация mobile-набора тайлов за один прогон
- [x] Протестировать на синтетической equirectangular (2048x1024 градиент)

### Пакет `editor`
- [x] Scaffold (Vite + React + TS)
- [x] Создать `src/store/types.ts` — все TypeScript-типы схемы тура
- [x] Создать `src/store/tourStore.tsx` — Context + useReducer (13 actions)
- [x] Реализовать `PanoramaList` — загрузка файлов, список сцен
- [x] Реализовать `PanoramaCanvas` — Marzipano EquirectGeometry, клик → yaw/pitch
- [x] Реализовать `HotspotPanel` — список хотспотов, кнопка добавить/удалить
- [x] Реализовать `NavHotspotForm` — поля link-хотспота
- [x] Реализовать `InfoHotspotForm` — поля info-хотспота
- [x] Реализовать `SceneSettings` — название сцены, initialView
- [x] Реализовать `exporter.ts` — сериализация store -> tour.json
- [x] Реализовать `zipper.ts` — упаковка в ZIP через JSZip
- [x] Добавить viewer-файлы в ZIP-архив (после реализации packages/viewer)
- [x] Реализовать экспорт в папку через File System Access API (Chrome/Edge)
- [x] Добавить fallback: если File System Access недоступен — только ZIP

### Пакет `viewer`
- [x] Создать базовую структуру файлов viewer
- [x] Реализовать `app.js` — загрузка tour.json, инициализация viewer
- [x] Реализовать `hotspots/NavHotspot.js`
- [x] Реализовать базовый переход (switchTo + targetYaw/targetPitch)
- [x] Реализовать `hotspots/InfoHotspot.js` + `hotspots/InfoPanel.js`
- [x] Реализовать `transitions/easing.js`
- [x] Реализовать `transitions/TransitionEngine.js` — Zoom + Fade (фаза Land удалена)
- [x] Mobile: при загрузке определять тип устройства, использовать `tiles/{id}/mobile/`
      и `mobile/manifest.json` если они присутствуют (graceful fallback на desktop)
- [ ] Протестировать полный цикл: tiler -> editor -> export -> viewer

---

## Улучшения UX редактора

- [ ] Drag-and-drop загрузка панорам (помимо file input)
- [x] Визуальные маркеры хотспотов прямо на canvas (поверх Marzipano)
- [x] Выделение активного хотспота при клике на маркер
- [ ] Предпросмотр перехода: стрелка от source-хотспота к target-сцене
- [ ] Undo/redo (история действий через useReducer)
- [ ] Импорт существующего `tour.json` для продолжения работы
- [ ] Валидация перед экспортом: предупреждение если есть сцены без хотспотов
- [ ] Миниатюры сцен в `PanoramaList` (thumbnail из preview.jpg)
- [ ] **Оптимизация текстуры редактора:** downscale входного equirectangular до 2048–4096px
      через `<canvas>` + `toBlob()` перед передачей в Marzipano. Текущий `{ width: 4000 }`
      не ограничивает размер текстуры — изображение 8192px грузится полностью в VRAM.
      (см. ADR-009 в ARCHITECTURE.md)

---

## Улучшения UX viewer

- [x] **Zoom управление:**
      — Desktop: кастомный scroll-wheel RAF-handler (Marzipano built-in scroll zoom
        отключён через `scrollZoom: false` — ненадёжен на некоторых платформах).
        `fovTarget` накапливает дельты колеса; RAF-цикл сглаживает с коэфф. 0.18.
      — Mobile: кастомные capture-фазные обработчики `touchstart`/`touchmove` (2 пальца)
        с `stopPropagation`/`preventDefault`, чтобы не конфликтовать с Hammer.js.
- [ ] Анимация хотспота: пульсация при idle
- [ ] Индикатор загрузки сцены во время перехода
- [ ] Плавное появление хотспотов после завершения перехода
- [ ] Кнопка fullscreen
- [ ] Autorotate при бездействии (пауза при hover на хотспоте)
- [x] Закрытие InfoPanel по клику вне панели и по Escape
- [x] Остановка видео в InfoPanel при закрытии
- [x] Поддержка `<video>` (локальные mp4) и YouTube iframe в InfoPanel
- [x] YouTube офлайн-заглушка: `navigator.onLine` → `t('video.offline')` вместо iframe
- [x] Escape в InfoPanel: `stopImmediatePropagation` — изолирован от TOUR_EXIT
- [x] Диагностический лог `?debug=1`: параметры загрузки, TOUR_EXIT (с причиной), TOUR_ACTIVITY

---

## Технический долг

- [ ] Настроить ESLint для editor (eslint + @typescript-eslint)
- [ ] Настроить ESLint для tiler (eslint + node globals)
- [ ] JSDoc-аннотации на публичные функции TransitionEngine
- [ ] JSDoc-аннотации на публичные функции InfoPanel
- [ ] Проверить утечки памяти при многократных переходах (hotspotContainer cleanup)
- [ ] Проверить корректность позиционирования хотспотов при resize окна
- [ ] Добавить обработку ошибок загрузки тайлов (fallback на preview.jpg)
- [ ] Версионирование схемы tour.json (поле `version`) с миграциями

---

## Electron-редактор (планирование завершено, реализация — следующий этап)

> Заменяет browser-based editor + Express-сервер (Variant B) единым desktop-приложением.
> Подробный план: `docs/electron-agent-briefing.md`

### Фаза 0 — Управление проектом
- [ ] **0.1** Scaffold: `packages/electron/` — `electron-builder`, `electron`, preload-скрипт
- [ ] **0.2** `main.js` — `BrowserWindow`, IPC-канал `main↔renderer`, `app.getAppPath()`
- [ ] **0.3** Проверка Node.js при запуске: `child_process.execSync('node -e ""')` →
      если не найден — `dialog.showMessageBoxSync` с инструкцией; приложение завершается
- [ ] **0.4** Диалог «Создать проект»: `showSaveDialog` → создать папку + `project.json` + `scenes/` + `tiles/` + `media/`
- [ ] **0.5** Диалог «Открыть проект»: `showOpenDialog` → читать `project.json`, валидация `schemaVersion`
- [ ] **0.6** «Сохранить» (`Ctrl+S`): запись `project.json` (тихо, без диалога)
- [ ] **0.7** Автосохранение: дебаунс 3 с после каждого изменения store

### Фаза 1 — Сцены
- [ ] **1.1** «Добавить сцену»: `showOpenDialog` JPEG → `fs.copyFile` → `scenes/{sceneId}.jpg`
- [ ] **1.2** Переименовать сцену: inline-редактирование → `displayName` в `project.json`
- [ ] **1.3** Удалить сцену: удалить из `project.json` + `scenes/`, `tiles/`, `tiles/..-mobile/` (рекурсивно);
      очистить хотспоты с битыми ссылками в других сценах
- [ ] **1.4** Порядок сцен: drag-and-drop в списке → обновить порядок
- [ ] **1.5** Начальная сцена: переключатель «Начальная» → ровно одна отмечена
- [ ] **1.6** Thumbnail в списке: `tiles/{sceneId}/preview.jpg` если тайлинг выполнен, иначе placeholder

### Фаза 2 — Тайлинг
- [ ] **2.1** Кнопка «Нарезать» у сцены: `child_process.spawn('node', ['tiler.js', '--input', scenePath, '--output', tilesDir, '--id', sceneId, '--mobile'])`
- [ ] **2.2** Кнопка «Нарезать всё»: очередь сцен без актуальных тайлов
- [ ] **2.3** Парсинг stdout тайлера → прогресс-бар / spinner рядом со сценой
- [ ] **2.4** `project.json`: поле `scene.tiledAt` + хеш исходника (`sha1`); индикатор «актуально / устарело / не нарезано»
- [ ] **2.5** Предупреждение «тайлы устарели» при изменении JPEG + кнопка «Перенарезать»
- [ ] **2.6** Параллельная очередь: concurrency = `os.cpus().length - 1`; общий прогресс «12 / 87 сцен»

### Фаза 3 — Параметры тура
- [ ] **3.1** Поля: название тура, `defaultLang` (ru/uz/en), `autorotate.enabled` + `speed`
- [ ] **3.2** Кнопка «Capture view» → записать текущий `initialView` (yaw/pitch/fov) для активной сцены

### Фаза 4 — Nav-хотспоты
- [ ] **4.1** Режим добавления: клик по canvas → yaw/pitch → создать хотспот
- [ ] **4.2** Выбор целевой сцены из выпадающего списка
- [ ] **4.3** Поля `targetYaw`, `targetPitch`, `targetFov` (опционально)
- [ ] **4.4** Маркер на canvas (поверх Marzipano), выделение при клике
- [ ] **4.5** Удалить хотспот

### Фаза 5 — Info-хотспоты
- [ ] **5.1** Добавить по клику на canvas (аналогично nav)
- [ ] **5.2** Поля `title`, `text` (multiline textarea)
- [ ] **5.3** Изображение: `showOpenDialog` → `fs.copyFile` → `media/`, относительный путь
- [ ] **5.4** Видео: `showOpenDialog` (mp4) → `media/` или YouTube URL

### Фаза 6 — Предпросмотр
- [ ] **6.1** Кнопка «Предпросмотр»: генерировать `tour.json` во временную папку (temp)
- [ ] **6.2** Открыть отдельный `BrowserWindow` с `packages/viewer/index.html` + `tour.json`
- [ ] **6.3** «Обновить предпросмотр»: перегенерировать `tour.json` + reload окна

### Фаза 7 — Экспорт
- [ ] **7.1** Валидация: предупреждение о сценах без тайлов, без хотспотов, с битыми ссылками
- [ ] **7.2** «Экспорт в папку»: `showOpenDialog` → копировать `tiles/` + `media/` + `packages/viewer/*` + `tour.json`
- [ ] **7.3** «Экспорт ZIP»: JSZip в main-процессе → `fs.writeFile` → сохранить через `showSaveDialog`
- [ ] **7.4** `shell.openPath(outputDir)` — открыть папку в Проводнике после экспорта

### Дистрибуция
- [ ] **D.1** `electron-builder` target: `portable` (один `.exe`, без установки, Windows x64)
- [ ] **D.2** `extraFiles`: `packages/tiler/` + `node_modules/sharp` + deps рядом с `.exe`
- [ ] **D.3** В `main.js`: найти `tiler.js` относительно `app.getAppPath()` (не `__dirname`)
- [ ] **D.4** README: инструкция установки Node.js (ссылка на nodejs.org) как предварительное условие

---

## Editor UI/UX — очередь задач (делаем по одной, с проверкой)

### Навигация и панель сцен
- [x] **U.1** История сцен Back/Forward: стек посещённых сцен в store
      (`SET_ACTIVE_SCENE` пишет в историю); кнопки-стрелки ← → под заголовком SCENES;
      Forward активна только после Back; выбор сцены вручную после Back обрезает forward-ветку;
      кнопки disabled, когда идти некуда
- [x] **U.2** Ресайз левой панели: драг за правую кромку (невидимая зона захвата ~6px),
      запись в `--panel-width-left`, ограничение 160–480px, ширина сохраняется в `localStorage`
- [ ] **U.3** Tooltip с путём исходника при hover на сцене в списке:
      `scene:add` возвращает абсолютный путь выбранного файла → опциональное поле
      `originalPath` в `project.json`; для старых сцен fallback — `scenes/{sceneId}.jpg`;
      удаляется вместе со сценой
- [x] **U.4** Запоминание положения камеры per-scene в сессии редактора:
      map `sceneId → {yaw, pitch, fov}` (память, не `project.json` — не путать с `initialView`);
      сохранять при переключении сцены, восстанавливать при возврате вместо `initialView`

### Интеграция с киоском
- [ ] **U.5** Документ `docs/kiosk-map-linking.md`: рекомендации по связке карты киоска
      со сценами тура — точка на карте хранит `{tourId, sceneId, yaw?, pitch?, fov?}`;
      холодный старт через URL `?scene=`, живой iframe — через `TOUR_NAVIGATE`;
      правила стабильности sceneId при пересборке тура

### Предложения (обсудить)
- [ ] **U.6** Кнопка «Go to target scene» в NavHotspotForm: переключить canvas на целевую
      сцену одним кликом — ускоряет цикл Capture view → Apply
- [ ] **U.7** Валидация arrival при экспорте: если у nav-хотспотов `arrivalSet == false`,
      показать список «N хотспотов без направления прибытия» перед экспортом (расширение 7.1)
- [ ] **U.8** Горячие клавиши: Esc — отмена режима размещения хотспота,
      Delete — удалить выбранный хотспот, Ctrl+S — сохранить проект
- [ ] **U.9** Запоминать размер/позицию окна Electron между запусками
      (`browser-window` bounds в `userData`)
- [ ] **U.10** Индикатор несохранённых изменений в ProjectBar (точка у имени проекта,
      сбрасывается автосохранением)
- [ ] **U.11** Перетаскивание сцен в списке вверх/вниз (смена порядка; детализация 1.4):
      drag-handle слева у элемента — шесть точек в две колонки (3 ряда по 2, цвет
      `--text-muted`); drag только за handle, чтобы не конфликтовать с кликом-выбором
      и чекбоксом; при drop — новый порядок в store и в `project.json`
      (порядок массива `scenes`); визуальный индикатор места вставки

---

## Функциональные идеи (backlog)

- [~] Тайлинг прямо в браузере (WebAssembly libvips) — не планируется: требует COOP/COEP
      заголовков, что ломает YouTube iframe в InfoPanel; Node.js tiler покрывает все сценарии
- [ ] Навигационная карта-схема (floor plan) с отметкой текущей позиции
- [ ] Глубокие ссылки: URL hash `#scene-id` для прямого перехода к сцене
- [ ] Галерея изображений внутри InfoPanel (несколько фото)
- [ ] Аудиогид: поле `audioUrl` в сцене, воспроизведение при входе
- [ ] Серверный API для хранения туров (FastAPI бэкенд — отдельный проект)
- [ ] Режим kiosk: отключение UI-элементов управления, только хотспоты
- [ ] Экспорт в iframe-embed код для вставки на сторонний сайт
