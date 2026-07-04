# CHANGELOG.md — panotour

> Краткая хронология. Не дублирует `git log`, но даёт быстрый обзор
> без погружения в коммиты. Добавляй запись в конце каждой сессии.

---

## [2026-06-01] — Основание проекта

**Что сделано:**
- Принято ключевое архитектурное решение: собственный редактор + viewer + tiler
  вместо форка Marzipano Tool (исходники закрыты, wontfix).
- Определена monorepo-структура: `packages/editor`, `packages/viewer`, `packages/tiler`.
- Зафиксирована схема данных `tour.json` — центральный контракт редактора и viewer.
- Подготовлена документация для запуска в режиме Code:
  `CONTEXT.md`, `TODO.md`, `ARCHITECTURE.md`, `CHANGELOG.md`.
- Задокументированы архитектурные решения ADR-001 — ADR-008.

**Примечание:** Кодовой базы пока нет. Следующий шаг — настройка репозитория
(см. раздел "Что сделать в репозитории перед первой сессией" в README.md).

---

## [2026-06-01] — Пакет `tiler` — реализован

**Пакет:** tiler

**Что сделано:**
- Реализован CLI `tiler.js` (аргументы `--input`, `--output`, `--id`, `--mobile`).
- `lib/cubemapTiler.js` — собственная обратная проекция equirectangular → CubeGeometry
  с билинейной интерполяцией (без внешних зависимостей на Canvas API).
- `lib/manifest.js` — генерация `manifest.json` с уровнями для Marzipano.
- Флаг `--mobile`: один прогон проекции — два независимых набора тайлов
  (desktop tileSize=512, mobile tileSize=256, 4× меньше VRAM).
- Порядок граней: 0=+X, 1=−X, 2=+Y, 3=−Y, 4=+Z (фронт), 5=−Z (зад).

**Почему:** `panorama-to-cubemap` требует Canvas API — несовместим с Node.js.
Реализован собственный математический конвертер (lon/lat → px/py → bilinear sample).

---

## [2026-06-01] — Пакет `editor` — реализован

**Пакет:** editor

**Что сделано:**
- Scaffold: React 19 + Vite 8 + TypeScript 6.
- `src/store/types.ts` — все TypeScript-типы схемы тура (TourData, Scene, Hotspot и др.).
- `src/store/tourStore.tsx` — Context + useReducer, 9 actions.
- `PanoramaList` — загрузка файлов (`input[type=file]`), список сцен.
- `PanoramaCanvas` — превью через Marzipano `EquirectGeometry`, клик → yaw/pitch.
- `SceneSettings` — название сцены, поля initialView.
- `HotspotPanel` — список хотспотов + кнопки "+ Nav" / "+ Info".
- `NavHotspotForm` — targetSceneId (select), targetYaw/Pitch/Fov.
- `InfoHotspotForm` — title, text, imageUrl, videoUrl.
- `exporter.ts` — `exportTour()` снимает `panoramaObjectUrl`, возвращает чистый `TourData`.
- `zipper.ts` — `downloadTourJson()` (Blob), `downloadZip()` (JSZip).
- `ExportButton` — кнопка экспорта в шапке редактора.

---

## [2026-06-01] — Пакет `viewer` — реализован (все 3 фазы)

**Пакет:** viewer

**Что сделано:**
- **Фаза 1:** `app.js` загружает `tour.json`, создаёт сцены через `CubeGeometry` +
  `ImageUrlSource` + `RectilinearView`, инициализирует `NavHotspot` и `InfoHotspot`.
- **Фаза 2:** `transitions/TransitionEngine.js` — трёхфазный переход:
  zoom-in к хотспоту (600ms) → crossfade (400ms) → zoom-out в новой сцене (500ms).
  `transitions/easing.js` — `easeInOutQuad`, `easeOutCubic`.
- **Фаза 3:** `hotspots/InfoPanel.js` — DOM-панель с текстом (innerHTML), фото,
  YouTube iframe и `<video>`. Закрытие по ×, Escape, клику вне панели.
- `marzipano.js` — Marzipano v0.10.2, скопирован как standalone-скрипт.

**Почему:** `setTimeout` вместо Promise-цепочек — Marzipano не имеет колбэков
завершения анимации (ADR-008).

---

## [2026-06-01] — Экспорт в папку, мобильные тайлы

**Пакет:** editor, viewer

**Что сделано:**
- `zipper.ts`: `exportToFolder()` — записывает `tour.json` + 9 файлов viewer
  напрямую в выбранную папку через File System Access API (Chrome/Edge);
  создаёт подпапки `hotspots/` и `transitions/` автоматически.
- `zipper.ts`: `hasFolderExport()` — проверка поддержки API в браузере.
- Fallback: если `showDirectoryPicker` недоступен (Firefox) — автоматически
  вызывает `downloadZip()`.
- `ExportButton.tsx`: добавлена кнопка "→ Folder"; `AbortError` (пользователь
  закрыл диалог) перехватывается без ошибки.
- `app.js`: `isMobile()` — определение мобильного устройства
  (userAgent + maxTouchPoints).
- `app.js`: `resolveSceneData()` — на мобильных устройствах запрашивает
  `tiles/{id}/mobile/manifest.json`; при успехе подставляет мобильные пути,
  при ошибке 404 или сетевой ошибке — тихий fallback на desktop.
  Все сцены резолвятся параллельно через `Promise.all`.

---

## [2026-06-01] — ZIP-экспорт с viewer-файлами

**Пакет:** editor

**Что сделано:**
- `vite.config.ts`: плагин `viewer-files` — dev-middleware `/viewer/*` →
  `packages/viewer/*`; `generateBundle` эмитирует все файлы viewer как ассеты.
- `zipper.ts`: `downloadZip()` фетчит 9 файлов viewer параллельно (`Promise.all`)
  и упаковывает их вместе с `tour.json`. Скачанный ZIP — готовый self-contained тур.

---

## [2026-06-02] — Исправление нумерации z-уровней тайлов

**Пакет:** tiler

**Что сделано:**
- `lib/cubemapTiler.js`: директории уровней теперь начинаются с `0/` вместо `1/`.
  Ранее использовалось `String(li + 1)`, что давало `1/`, `2/`, `3/`...
  Marzipano использует 0-based z-индекс (`z=0` — fallback/корневой уровень),
  поэтому запросы `0/`, `1/`, `2/`... приходили в несуществующие директории →
  тайлы отображались с артефактами (растянутые текстуры, неверные уровни).
- Документация `TESTING.md` обновлена: таблица уровней и примеры путей
  исправлены с `1/…` на `0/…`, добавлена колонка "Директории" в таблицу.

**Важно:** Все ранее сгенерированные тайлы нужно перегенерировать — старые
директории `1/`, `2/`... несовместимы с новой схемой.

---

## [2026-06-08] — Исправление isMobile() на тачскрин-ноутбуках

**Пакет:** viewer

**Что сделано:**
- `app.js`: `isMobile()` больше не даёт ложноположительный результат на Windows-ноутбуках
  с тачскрином. `navigator.maxTouchPoints > 1` теперь используется только вместе с
  проверкой `window.screen.width <= 768`. Без этой проверки Windows 10/11 репортил
  `maxTouchPoints = 10` для любого тачскрин-оборудования, включая full-HD ноутбуки —
  viewer грузил mobile-тайлы (faceSize=512) вместо desktop (faceSize=1024+).

**Почему:** Mobile UA-строка надёжна, но `maxTouchPoints` — нет. Добавление порога
ширины экрана ограничивает touch-ветку реально маленькими устройствами.

**Важно для пользователей:** если тур уже экспортирован, достаточно заменить только
`app.js` в папке тура — тайлы и `tour.json` обновлять не нужно.

---

## [2026-07-04] — Хотспоты: bounding box, перспектива, масштаб с FOV

**Пакет:** viewer

**Что сделано:**
- `NavHotspot.js`: внешний `.hotspot`-div теперь нулевого размера (0×0).
  Marzipano владеет `transform` внешнего элемента (`positionAbsolutely` перезаписывает
  его каждый кадр), поэтому вся визуальная трансформация перенесена на дочерние
  элементы (`.hotspot-scale`, `.hotspot-inner`).
- Добавлена обёртка `.hotspot-scale`: `translate(-50%, -50%) scale(var(--hs-scale, 1))`.
  `--hs-scale = REF_FOV / currentFOV` обновляется каждый кадр RAF-циклом в `app.js`.
  Хотспоты сохраняют постоянный визуальный размер при любом zoom.
- `NavHotspot.js`: перспективное сплющивание пола (`scaleX`/`scaleY`) применяется
  через `inner.style.transform`, а не через `extraTransforms` (иначе переопределялось бы
  Marzipano).
- Размер nav-хотспота удвоен: 56 → 112px, обводка 3 → 6px.
- `InfoHotspot.js`: аналогичная структура `.hotspot-scale` + `.hotspot-inner`.

**Почему:** `positionAbsolutely()` Marzipano устанавливает `style.transform` на внешнем
элементе каждый кадр — любые JS-трансформации на нём перезаписываются. Решение:
нулевой outer div + все трансформации на дочерних элементах.

---

## [2026-07-04] — Исправление preview.jpg: вертикальный стрип 256×1536

**Пакет:** tiler

**Что сделано:**
- `lib/cubemapTiler.js`: `preview.jpg` теперь является вертикальным стрипом 256×1536
  из 6 граней в порядке `bdflru` (back, down, front, left, right, up) — формат,
  ожидаемый Marzipano для `cubeMapPreviewUrl`.
  Раньше записывался только фронтальный фейс 256×256 — preview не отображался.

**Почему:** Marzipano читает `cubeMapPreviewUrl` как вертикальный стрип из 6 равных
частей, отображая каждую как одну грань куба (`i.indexOf(face)/6` вдоль Y-оси).

---

## [2026-07-04] — Исправление manifest.json: поле sceneId + FOV-конфликт

**Пакет:** editor, viewer

**Что сделано:**
- `SceneSettings.tsx`: editor принимает manifest-файлы с полем `sceneId` (выводит
  tiler) и `id` (старый формат): `manifest.sceneId ?? manifest.id`.
- `app.js`: `fovTarget = null` перед вызовом `engine.navigate()`. Иначе RAF-цикл
  scroll-zoom применял старый `fovTarget` к новой сцене, создавая паразитную
  FOV-анимацию поверх перехода.

---

## [2026-07-04] — TransitionEngine: удалена фаза приземления

**Пакет:** viewer

**Что сделано:**
- `TransitionEngine.js`: убрана фаза 3 (animateFov 20°→90° после switchTo).
  Целевая сцена теперь получает `targetFov` напрямую через `setParameters` до
  `switchTo()` — без анимации FOV после перехода.
- Добавлена константа `FADE_DURATION: 280`. Удалены `LAND_DURATION` и `animateFov`.

**Почему:** Фаза приземления создавала ощущение «отступления назад» — viewer
«нырял» в ZOOM_IN_FOV=20°, затем «отскакивал» к целевому FOV.

---

## [2026-07-04] — Kiosk IPC: i18n, кнопка выхода, TOUR_EXIT

**Пакет:** viewer

**Что сделано:**
- Создан `i18n.js`: словарь `uz/ru/en`, функция `t(key)` с fallback на `ru`,
  определение языка из `?lang=` URL-параметра.
- `app.js`: кнопка "Выход" (фиксированная, top-left) с `TOUR_EXIT` postMessage.
  Escape вне InfoPanel также отправляет `TOUR_EXIT`.
- `InfoPanel.js`: кнопка закрытия через `t('panel.close')`.
- `zipper.ts`: `i18n.js` добавлен в `VIEWER_FILES` (10 файлов вместо 9).

---

## [2026-07-04] — Навигация по ?scene= и TOUR_NAVIGATE postMessage

**Пакет:** viewer

**Что сделано:**
- `app.js`: стартовая сцена определяется по `?scene=sceneId` URL-параметру
  (fallback → `defaultSceneId` → первая сцена).
- `app.js`: обработчик `window.message` для `{ type: 'TOUR_NAVIGATE', sceneId, yaw?, pitch?, fov? }`.
  Выполняет прямой `switchTo(600ms)` без zoom-in/out фаз.

---

## [2026-07-04] — Вариант B: локальный сервер тайлинга

**Пакет:** server, editor, root

**Что сделано:**
- Создан пакет `packages/server/`: Express, `POST /api/tile` (multer 500 МБ),
  `GET /api/tile/:id/files`, `GET /tiles/*`, `GET /viewer/*`, `GET /api/health`.
  Вызывает `tileScene()` из tiler, поддерживает `mobile=1`.
- `packages/editor/src/lib/serverApi.ts`: транспортная абстракция.
  `checkServer()`, `tileOnServer(objectUrl, sceneId)`, `fetchTileFiles(sceneId)`.
  `SERVER_URL` из `VITE_TILER_SERVER` или `http://localhost:3333`.
- `SceneSettings.tsx`: кнопка "Tile on server ▶" + индикатор статуса сервера.
  Авто-заполнение `tilesPath`, `previewUrl`, `levels` после тайлинга.
- `zipper.ts`: функция `downloadZipWithTiles()` — ZIP с тайлами с сервера.
- `package.json` (root): `npm run server` и `npm run dev` (concurrently).

**Почему:** Позволяет нарезать панорамы прямо из editor без отдельного CLI.
Транспортная абстракция (`serverApi.ts`) упрощает будущую миграцию на Electron IPC.

---

## [2026-07-04] — TOUR_ACTIVITY: beacon активности для сброса таймера киоска

**Пакет:** viewer

**Что сделано:**
- `app.js`: IIFE `initActivityBeacon()` вешает capture-фазные passive-слушатели
  на `pointerdown`, `pointermove`, `wheel`, `keydown`, `touchstart`, `touchmove`.
  При активности отправляет `{ type: 'TOUR_ACTIVITY' }` родителю, throttle 2500 мс,
  leading-режим. Только в iframe (`window.parent !== window`).
  Слушатели снимаются на `beforeunload`.

**Почему:** iframe поглощает события — родительское окно киоска не видит активность
пользователя и может преждевременно сбросить тур по таймеру бездействия.

---

<!--
Шаблон для будущих сессий:

## [YYYY-MM-DD] — Заголовок

**Пакет:** editor | viewer | tiler | root

**Что сделано:**
- Пункт 1
- Пункт 2

**Почему:** Обоснование, если неочевидно.

**Сломано / известные проблемы:** (если есть)
-->
