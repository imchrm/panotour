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
