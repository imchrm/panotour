# CONTEXT.md — panotour

> Главный файл для AI-сессий. Передай его в начале сессии — AI сразу в контексте.
> В конце сессии обновляй разделы "Что сделано" и "Следующий шаг".

---

## Проект

**Название:** panotour — редактор и viewer 360-туров на базе Marzipano
**Репозиторий:** `panotour` (GitHub)
**Концепция:** Собственный редактор хотспотов + tiler + viewer. Полный контроль
над схемой данных тура. Независимость от Marzipano Tool.

**Пакеты в одном репозитории (monorepo):**

| Пакет | Путь | Назначение |
|---|---|---|
| `electron` | `packages/electron/` | Electron main-процесс: проект на диске, тайлинг, предпросмотр, экспорт |
| `editor` | `packages/editor/` | React + Vite. UI редактора — renderer Electron (работает и в браузере) |
| `viewer` | `packages/viewer/` | Vanilla JS. Готовый тур: рендер панорам, переходы, InfoPanel |
| `tiler` | `packages/tiler/` | Node.js CLI. Нарезка equirectangular → CubeGeometry тайлы |
| `server` | `packages/server/` | **Legacy.** Express-сервер тайлинга (Вариант B), заменён Electron IPC |

---

## Стек

### Editor (`packages/editor/`)
| Слой | Технология |
|---|---|
| UI фреймворк | React 19 + TypeScript 6 |
| Сборка | Vite 8 |
| Стили | CSS Modules |
| Превью панорамы | Marzipano (встроен в редактор для позиционирования хотспотов) |
| Хранение состояния | React Context + useReducer |
| Экспорт | JSZip (ZIP) + FileSaver.js |

### Viewer (`packages/viewer/`)
| Слой | Технология |
|---|---|
| 360° рендер | Marzipano (standalone `marzipano.js`) |
| Логика | Vanilla JS (ES2020, ES modules) |
| Стили | CSS3 |
| Входные данные | `tour.json` — генерируется редактором |

### Tiler (`packages/tiler/`)
| Слой | Технология |
|---|---|
| Runtime | Node.js 20+ |
| Нарезка | Собственная обратная проекция equirectangular→куб + `sharp` |
| Интерфейс | CLI (`node tiler.js --input pano.jpg --output ./tiles/scene-01`) |

### Electron (`packages/electron/`)
| Слой | Технология |
|---|---|
| Runtime | Electron 33 (main-процесс CommonJS) |
| Renderer | `packages/editor` (dev: `http://localhost:5173`, prod: `loadFile`) |
| IPC | `contextBridge` → `window.electronApi`; `ipcRenderer.invoke` / `ipcMain.handle` |
| Файлы | Только в main-процессе (`project.js`, `preview.js`, `export.js`) |
| Тайлинг | `child_process.spawn('node', [tiler.js, ...])` (`tiling.js`) |
| Предпросмотр | Второй BrowserWindow, кастомный протокол `ptour://` |
| Экспорт | Папка (копирование) или ZIP (`archiver`) в main-процессе |
| Сборка | `electron-builder`, Windows portable, tiler в `extraFiles` |
| Запуск | `npm run editor` + `npm run electron` |

### Server (`packages/server/`) — legacy
Express-сервер тайлинга (Вариант B: multer + `tileScene()`). Заменён Electron IPC,
код сохранён для браузерного режима; новые фичи в него не добавляются.

---

## Структура файлов

```
panotour/
  packages/
    editor/
      src/
        components/
          PanoramaList/       # Список загруженных панорам
          PanoramaCanvas/     # Превью панорамы с Marzipano для клика по хотспотам
          HotspotPanel/       # Форма редактирования выбранного хотспота
          InfoHotspotForm/    # Подформа для type=info (текст, фото, видео)
          NavHotspotForm/     # Подформа для type=link (targetYaw, targetPitch, targetFov)
          ExportButton/       # Кнопка экспорта (ZIP + папка)
          SceneSettings/      # Настройки сцены (название, initialView, тайлинг)
        store/
          tourStore.ts        # Context + useReducer: состояние тура
          types.ts            # TourData, Scene, Hotspot, InfoContent и др.
          LoadingOverlay/     # Модальный прогресс загрузки проекта
          ProjectBar/         # New/Open/Save проекта, автосейв, статус
        lib/
          exporter.ts         # Генерация tour.json из состояния store
          zipper.ts           # Упаковка в ZIP через JSZip (браузерный режим)
          electronApi.ts      # Типизированная обёртка window.electronApi + project flows
          panoramaPreview.ts  # Даунскейл панорамы до 4096px для canvas
        App.tsx               # Layout + ресайз левой панели
        main.tsx
      index.html
      vite.config.ts
      tsconfig.json
      package.json

    electron/
      main.js                 # BrowserWindow, IPC-обработчики, checkNodeJs, лог
      preload.js              # contextBridge: window.electronApi
      project.js              # createProject/openProject/saveProject/сцены на диске
      tiling.js               # resolveTilerPath, runTiler (spawn), runPool
      preview.js              # tour.json во временную папку, протокол ptour://
      export.js               # exportToFolder, exportToZip (archiver)
      log.js                  # файловый лог + метрики процессов
      scripts/
        stage-tiler.js        # Копирование tiler в extraFiles при сборке
        verify-project-ipc.js # Headless-проверка project IPC (npm run verify)
      electron-builder.yml    # Windows portable

    viewer/
      index.html
      app.js                  # Инициализация viewer, загрузка tour.json
      i18n.js                 # Словарь uz/ru/en + t(key) + определение lang
      style.css
      marzipano.js            # Библиотека (не модифицируется)
      transitions/
        TransitionEngine.js   # Zoom + Fade оркестрация
        easing.js             # easeInOutQuad, easeOutCubic, easeInQuad
      hotspots/
        NavHotspot.js         # Хотспот перехода между сценами
        InfoHotspot.js        # Хотспот вызова InfoPanel
        InfoPanel.js          # DOM-компонент информационной панели
      tour.json               # Данные тура (генерируется редактором, заменяется при деплое)
      tiles/                  # Тайлы (из server/workspace/tiles/ или CLI tiler)
        {scene_id}/
          preview.jpg         # Вертикальный стрип 256×1536 (6 граней: b,d,f,l,r,u)
          {z}/{f}/{y}/{x}.jpg
          manifest.json

    server/
      server.js               # Express: POST /api/tile, GET /tiles/*, GET /viewer/*
      package.json
      .gitignore              # игнорирует workspace/
      workspace/              # (не в git)
        tiles/
          {scene_id}/         # Результат тайлинга через API

    tiler/
      tiler.js                # CLI точка входа
      lib/
        cubemapTiler.js       # Собственная обратная проекция + sharp
        manifest.js           # Генерация манифеста уровней для Marzipano
      package.json

  package.json                # Root: workspaces, dev/server/editor скрипты
  .gitignore
  README.md
```

---

## Схема данных `tour.json`

Это центральный контракт между редактором и viewer. Редактор генерирует,
viewer читает. Схема расширяется добавлением полей — обе стороны под нашим контролем.

```json
{
  "version": "1.0",
  "defaultSceneId": "scene-01",
  "scenes": [
    {
      "id": "scene-01",
      "title": "Главный вход",
      "tilesPath": "tiles/scene-01",
      "previewUrl": "tiles/scene-01/preview.jpg",
      "levels": [
        { "tileSize": 256, "size": 256, "fallbackOnly": true },
        { "tileSize": 512, "size": 512 },
        { "tileSize": 512, "size": 1024 }
      ],
      "initialView": {
        "yaw": 0.0,
        "pitch": 0.0,
        "fov": 1.5707963
      },
      "hotspots": [
        {
          "id": "hs-001",
          "type": "link",
          "yaw": 1.23,
          "pitch": -0.1,
          "targetSceneId": "scene-02",
          "targetYaw": -1.57,
          "targetPitch": 0.0,
          "targetFov": 1.5707963
        },
        {
          "id": "hs-002",
          "type": "info",
          "yaw": 0.5,
          "pitch": 0.1,
          "content": {
            "title": "Название объекта",
            "text": "Описание в формате plain text или HTML",
            "imageUrl": "media/photo-01.jpg",
            "videoUrl": "https://www.youtube.com/embed/VIDEOID"
          }
        }
      ]
    }
  ]
}
```

**Все угловые значения — радианы.** `fov` — горизонтальный (соответствует Marzipano API).

---

## Ключевые константы viewer

```js
// transitions/TransitionEngine.js
const T = {
  WIDE_FOV:      1.7453,  // ~100° — кратковременное расширение FOV ("вдох")
  NORMAL_FOV:    1.5708,  // ~90°  — стандартный FOV
  ZOOM_IN_FOV:   0.3491,  // ~20°  — агрессивный zoom (ощущение движения)
  INHALE_MS:     80,      // мс — фаза вдоха
  RUSH_MS:       520,     // мс — фаза рывка
  FADE_DURATION: 280,     // мс — crossfade между сценами
};
// LAND_DURATION и animateFov удалены: целевая сцена появляется сразу с targetFov.
```

## Кiosk IPC — контракт

Viewer встраивается как `<iframe>` в Electron-киоск. Все взаимодействия
только через URL-параметры и `postMessage` — без дополнительных каналов.

### Входящие параметры (URL)

| Параметр | Значения | По умолчанию | Описание |
|---|---|---|---|
| `?lang=` | `uz` \| `ru` \| `en` | `ru` | Язык UI (кнопки, подсказки, ошибки) |
| `?scene=` | любой `sceneId` из `tour.json` | `defaultSceneId` | Начальная сцена при открытии |
| `?debug=1` | `1` | выключен | Диагностический лог в консоль (`[panotour]`); в проде не передавать |

Пример: `viewer/index.html?lang=uz&scene=scene-02`  
Пример (отладка): `viewer/index.html?lang=ru&debug=1`

### Входящие сообщения (postMessage → viewer)

```js
// Перейти к конкретной сцене (прямой crossfade, 600ms)
window.frames[0].postMessage({
  type:   'TOUR_NAVIGATE',
  sceneId: 'scene-02',       // обязательно — id сцены из tour.json
  yaw:    1.23,              // необязательно — угол прибытия (рад)
  pitch: -0.05,              // необязательно
  fov:    1.5707,            // необязательно
}, '*');
```

Если `yaw/pitch/fov` не переданы — используется `initialView` целевой сцены.
Если `sceneId` не найден или совпадает с текущей — сообщение игнорируется.

### Исходящие сообщения (viewer → родительский фрейм)

```js
// Пользователь нажал кнопку "Выход" или Escape (вне InfoPanel)
window.parent.postMessage({ type: 'TOUR_EXIT' }, '*');

// Активность пользователя внутри iframe — throttle 2500 мс, leading-режим
// Только когда viewer встроен в iframe (window.parent !== window)
window.parent.postMessage({ type: 'TOUR_ACTIVITY' }, '*');
```

`TOUR_ACTIVITY` отправляется не чаще 1 раза в 2500 мс при любом из событий:
`pointerdown`, `pointermove`, `wheel`, `keydown`, `touchstart`, `touchmove` (capture-фаза, passive).
Используется для сброса таймера бездействия в родительском окне киоска.

---

## Marzipano API — выжимка для AI

```js
// Инициализация
const viewer = new Marzipano.Viewer(element, { controls: { mouseViewMode: 'drag' } });

// Создание сцены
const geometry = new Marzipano.CubeGeometry(levels);
const source   = Marzipano.ImageUrlSource.fromString(
  'tiles/{scene_id}/{z}/{f}/{y}/{x}.jpg',
  { cubeMapPreviewUrl: 'tiles/{scene_id}/preview.jpg' }
);
// faceSize clamped to ≥4096 so minFOV doesn't exceed maxFOV on small tile sets
const limiter  = Marzipano.RectilinearView.limit.traditional(
  Math.max(maxSize, 4096), 100 * Math.PI / 180, 120 * Math.PI / 180
);
const view     = new Marzipano.RectilinearView(initialView, limiter);
const scene    = viewer.createScene({ source, geometry, view, pinFirstLevel: true });

// Переключение сцены (встроенный Fade)
scene.switchTo({ transitionDuration: 1000 });

// Анимация взгляда
scene.lookTo({ yaw, pitch, fov }, { transitionDuration: 600 });

// Текущий view
const view  = scene.view();
view.yaw(); view.pitch(); view.fov();
view.setParameters({ yaw, pitch, fov });

// Хотспоты
scene.hotspotContainer().createHotspot(domElement, { yaw, pitch });
```

---

## Три фазы viewer (порядок реализации)

### Фаза 1 — Базовый viewer
- Загрузка `tour.json`
- Рендер сцен через Marzipano
- Навигационные хотспоты с встроенным Fade (`scene.switchTo`)
- Корректный `targetYaw` / `targetPitch` при входе в сцену

### Фаза 2 — Кастомные переходы
- `TransitionEngine`: Zoom-in к хотспоту → Fade → Zoom-out в новой сцене
- `easing.js`: easeInOutQuad, easeOutCubic, easeInQuad

### Фаза 3 — InfoPanel
- Информационные хотспоты (`type: "info"`)
- DOM-панель: текст + изображение + YouTube embed / `<video>`
- Закрытие по кнопке, по Escape, по клику вне панели

---

## Редактор — порядок реализации

### Этап 1 — Скелет и типы
- Monorepo: root `package.json` с workspaces
- `packages/editor`: Vite + React + TypeScript
- `types.ts`: `TourData`, `Scene`, `Hotspot`, `NavHotspot`, `InfoHotspot`, `InfoContent`
- `tourStore.ts`: Context + useReducer, actions: ADD_SCENE, UPDATE_SCENE, ADD_HOTSPOT,
  UPDATE_HOTSPOT, DELETE_HOTSPOT, SET_DEFAULT_SCENE

### Этап 2 — Загрузка панорам и превью
- `PanoramaList`: загрузка файлов через `<input type="file" multiple accept="image/*">`
- `PanoramaCanvas`: рендер выбранной панорамы через Marzipano для визуального
  позиционирования хотспотов (клик → yaw/pitch из `view.screenToCoordinates()`)

### Этап 3 — Редактирование хотспотов
- `HotspotPanel`: список хотспотов сцены + кнопка добавить
- `NavHotspotForm`: поля targetSceneId (select), targetYaw, targetPitch, targetFov
- `InfoHotspotForm`: поля title, text (textarea), imageUrl, videoUrl

### Этап 4 — Экспорт
- `exporter.ts`: генерация `tour.json` из состояния store
- `zipper.ts`: упаковка viewer + tour.json + tiles (если загружены) в ZIP
- Экспорт папки: `showDirectoryPicker()` (File System Access API) — только Chrome/Edge

---

## Tiler — реализован

```bash
# Только desktop
node tiler.js --input ./panos/entrance.jpg --output ./tiles/scene-01 --id scene-01

# Desktop + mobile за один прогон
node tiler.js --input ./panos/entrance.jpg --output ./tiles/scene-01 --id scene-01 --mobile
```

Генерирует (без `--mobile`):
```
tiles/scene-01/
  preview.jpg          (256×1536, вертикальный стрип 6 граней: b,d,f,l,r,u)
  {z}/{f}/{y}/{x}.jpg
  manifest.json
```

Генерирует (с `--mobile`):
```
tiles/scene-01/
  preview.jpg
  {z}/{f}/{y}/{x}.jpg
  manifest.json
  mobile/
    preview.jpg
    {z}/{f}/{y}/{x}.jpg
    manifest.json
```

**Флаг `--mobile`:** проецирует 6 граней один раз (на desktop faceSize), затем
из тех же буферов нарезает два независимых набора тайлов. Дополнительного времени
на проекцию не тратится, только на resize + запись мобильных тайлов.

**Порядок граней (f в URL — буквенные коды Marzipano):**
| f    | Направление | Центр панорамы |
|---|---|---|
| `r` | +X (правая грань)      | lon=+90° |
| `l` | -X (левая грань)       | lon=-90° |
| `u` | +Y (верхняя грань)     | lat=+90° |
| `d` | -Y (нижняя грань)      | lat=-90° |
| `f` | +Z (фронтальная грань) | lon=0° — центр equirectangular |
| `b` | -Z (задняя грань)      | lon=±180° |

**z — 0-based:** z=0 — fallback (256×256, загружается первым), z=N — максимальное качество.

**Desktop — уровни по ширине входного изображения:**
| Ширина | faceSize | Уровни (size / tileSize) |
|---|---|---|
| < 2048  | 256  | 256/256(fb) |
| 2048    | 512  | 256/256(fb), 512/512 |
| 4096    | 1024 | 256/256(fb), 512/512, 1024/512 |
| 8192    | 2048 | 256/256(fb), 512/512, 1024/512, 2048/512 |
| 16384   | 4096 | 256/256(fb), 512/512, 1024/512, 2048/512, 4096/512 |

**Mobile — всегда:**
| faceSize | Уровни (size / tileSize) | Макс. GPU-текстура |
|---|---|---|
| min(512, desktopFaceSize) | 256/256(fb), 512/256 | 256×256 (4× меньше desktop) |

**Viewer — переключение на mobile:** изменить `tilesPath` сцены с `tiles/scene-01`
на `tiles/scene-01/mobile` и загрузить `mobile/manifest.json`.

**Зависимости:** `sharp` (нативный, через libvips), `minimist`
**Конвертация:** обратная проекция equirectangular → CubeGeometry, билинейная интерполяция.

---

## Editor — реализован полностью

**Стек:** React 19 + Vite 8 + TypeScript 6. Marzipano подключён через npm (`marzipano ^0.10.2`).

**Архитектура:** 3-колоночный layout.
```
┌─────────────┬───────────────────────────┬──────────────────┐
│ PanoramaList│     PanoramaCanvas        │  SceneSettings   │
│  220px      │   (Marzipano viewer)      │  HotspotPanel    │
│             │   EquirectGeometry        │  NavHotspotForm  │
│             │   клик → ADD_HOTSPOT      │  InfoHotspotForm │
│             │                           │     300px        │
└─────────────┴───────────────────────────┴──────────────────┘
```

**Состояние (`tourStore.tsx`):**
```typescript
EditorState {
  tour: { version, defaultSceneId, scenes: EditorScene[] }
  activeSceneId: string | null
  activeHotspotId: string | null
  placingHotspot: false | 'link' | 'info'
  capturedView: { yaw, pitch, fov } | null  // захват камеры ("Capture view")
  flipArrivalYaw: boolean                    // авто-разворот targetYaw на 180° (по умолчанию true)
  sceneHistory: string[]                     // история посещённых сцен (Back/Forward)
  historyIndex: number
}
```
`EditorScene` extends `Scene` + `panoramaObjectUrl?: string` (Object URL) +
`originalPath?: string` (абсолютный путь исходного JPEG, tooltip в списке).
`NavHotspot` + `arrivalSet?: boolean` — направление прибытия задано явно
(Capture view / ручной ввод); `false` → предупреждение в UI. Служебные поля
(`panoramaObjectUrl`, `originalPath`, `arrivalSet`) вырезаются из tour.json
при экспорте, но сохраняются в project.json.

17 actions: ADD/UPDATE/DELETE_SCENE, MOVE_SCENE (drag-and-drop порядок),
SET_DEFAULT_SCENE, SET_ACTIVE_SCENE, LOAD_TOUR, ADD/UPDATE/DELETE_HOTSPOT,
SET_ACTIVE_HOTSPOT, START/CANCEL_PLACING_HOTSPOT, CAPTURE_VIEW,
TOGGLE_FLIP_ARRIVAL_YAW, HISTORY_BACK/FORWARD.

**UI-возможности редактора (2026-07-08):**
- История сцен Back/Forward (кнопки ← → под заголовком SCENES)
- Запоминание положения камеры per-scene в рамках сессии (не пишется в project.json)
- Ресайз левой панели (драг за кромку, 160–480px, localStorage, double-click — сброс)
- Drag-and-drop порядок сцен за шеститочечный handle, порядок в project.json
- Tooltip с путём исходника на сценах; модальный прогресс загрузки проекта
- Marzipano canvas корректно пересчитывает размер через ResizeObserver

**Поток добавления хотспота:**
1. Нажать "+ Nav" / "+ Info" → `START_PLACING_HOTSPOT`
2. Клик по canvas → `view.screenToCoordinates({x,y})` → yaw/pitch
3. `ADD_HOTSPOT` → хотспот появляется в списке, открывается форма
4. Esc → `CANCEL_PLACING_HOTSPOT`

**Загрузка панорамы:** `<input type="file" multiple accept="image/*">` → `URL.createObjectURL(file)` → `ADD_SCENE`. Marzipano рендерит через `EquirectGeometry` без тайлинга.

**Экспорт и IPC (`src/lib/`):**
- `exporter.ts` — `exportTour()` вырезает служебные поля (`panoramaObjectUrl`,
  `originalPath`, `arrivalSet`), возвращает чистый `TourData`
- `zipper.ts` — браузерный режим: `downloadTourJson()`, `downloadZip()` (JSZip),
  `exportToFolder()` (File System Access API, fallback на ZIP)
- `electronApi.ts` — типизированная обёртка `window.electronApi` (заменила `serverApi.ts`):
  project flows (create/open/restore/save + автосейв-merge), `readSceneObjectUrl()`,
  `projectToEditorScenes()`, `mergeEditorStateIntoProject()`
- В Electron экспорт/предпросмотр идут через IPC: `exportFolder`, `exportZip`, `openPreview`

**Тайлинг в Electron (PanoramaList):**
- Чекбоксы у сцен + "Tile selected (N)" — последовательная очередь через `tile:run`
- Прогресс парсится из stdout тайлера (уровни/грани, mobile-набор)
- Статус на сцене: спиннер / зелёная точка с числом уровней / красная при ошибке
- После успеха `tiledAt` + `sourceHash` пишутся в project.json (main-процесс)

---

## Viewer — реализован полностью

**Стек:** Vanilla JS (ES2020, ES modules). Marzipano v0.10.2 скопирован как `marzipano.js`.

**Архитектура:**
```
packages/viewer/
  index.html                  — подключает marzipano.js и app.js как module
  app.js                      — загрузка tour.json, инициализация viewer и сцен
  i18n.js                     — словарь uz/ru/en + t(key) + lang из URL
                                    # ключи: btn.exit, panel.close, error.load, video.offline
  style.css                   — базовые стили, хотспоты, InfoPanel, exit-кнопка
  marzipano.js                — библиотека (не модифицируется)
  hotspots/
    NavHotspot.js             — хотспот перехода (DOM-элемент с yaw/pitch)
    InfoHotspot.js            — хотспот информации (DOM-элемент)
    InfoPanel.js              — DOM-панель: текст + фото + YouTube/video
  transitions/
    TransitionEngine.js       — оркестрация Zoom + Fade
    easing.js                 — easeInOutQuad, easeOutCubic, easeInQuad
  tour.json                   — placeholder для разработки
```

**Поток инициализации (`app.js`):**
1. `fetch('tour.json')` → данные тура
2. Для каждой сцены: `CubeGeometry(levels)` + `ImageUrlSource` + `RectilinearView` → `viewer.createScene()`
3. `TransitionEngine` — создаётся один раз, управляет переходами
4. Для каждого хотспота сцены: `NavHotspot.create()` или `InfoHotspot.create()`
5. Стартовая сцена: `?scene=` URL-параметр → `defaultSceneId` → первая сцена в массиве
6. `startEntry.marzipanoScene.switchTo()` — показ стартовой сцены

**TransitionEngine — две фазы перехода (через хотспот):**
```
t=0:    from.lookTo(hotspot, WIDE_FOV=1.75, 80ms)            // вдох: FOV →100°
t=80:   from.lookTo(hotspot, ZOOM_IN_FOV=0.35, 520ms)        // рывок: FOV →20°
t=444:  to.view.setParameters(targetYaw/pitch/fov)
        to.switchTo(FADE_DURATION=280ms)                       // fade (на 70% рывка)
t=724:  _busy = false
```
Целевая сцена появляется сразу с `targetFov` (из hotspot.targetFov) — без фазы
приземления, чтобы не создавать ощущение отступления назад.

**Прямой переход через postMessage** (`TOUR_NAVIGATE`): `switchTo(600ms)` без фаз
zoom-in/out — используется для навигации из родительского фрейма (киоск).

**InfoPanel:**
- Открывается кликом на info-хотспот
- Поддерживает: текст (innerHTML), `imageUrl`, YouTube iframe (`/embed/` URL), `<video>` (локальный mp4)
- YouTube в офлайн-режиме: при `navigator.onLine === false` iframe заменяется текстовой заглушкой (`t('video.offline')`, стиль `.info-panel-offline`)
- Закрывается по кнопке ×, Escape (`stopImmediatePropagation` — не конкурирует с TOUR_EXIT из `app.js`), клику вне панели
- Останавливает медиа при закрытии (pause/src="")

**ZIP-экспорт (editor → viewer):**
- `vite.config.ts` — плагин `viewer-files`:
  - dev: middleware `/viewer/*` → `packages/viewer/*`
  - build: `generateBundle` → эмитирует все файлы viewer как `viewer/*` ассеты
- `zipper.ts` — `downloadZip()` фетчит 10 файлов viewer с `/viewer/*` (включая `i18n.js`), упаковывает в ZIP вместе с `tour.json`
- `downloadZipWithTiles()` — дополнительно фетчит тайлы с локального сервера (`GET /api/tile/:id/files` + `/tiles/:id/:path`) для каждой сцены с `levels.length > 0`; результат — самодостаточный ZIP тура

---

## Текущий статус

**Фаза:** Electron-редактор реализован (шаги 1–6 плана из
`docs/electron-agent-briefing.md`), идёт итеративная доработка UI/UX
(очередь U.1–U.11 в `docs/TODO.md`). Browser+Express вариант (B) — legacy.

**Electron-редактор (2026-07-06…08):**
- [x] Scaffold `packages/electron/`: main.js, preload.js (contextBridge), checkNodeJs
- [x] IPC проекта: `project:create/open/save/current`; папка проекта на диске
- [x] Сцены: `scene:add` (копия JPEG + originalPath), `scene:read`, `scene:delete`
- [x] Тайлинг: `tile:run`/`tile:runAll` (spawn tiler, прогресс, sourceHash, tiledAt)
- [x] Предпросмотр: `preview:open` — второй BrowserWindow, протокол `ptour://`
- [x] Экспорт: `export:folder`, `export:zip` (archiver), `shell.openPath`
- [x] Renderer мигрирован: `serverApi.ts` удалён → `electronApi.ts`; ProjectBar (автосейв)
- [x] Диагностика: файловый лог + метрики процессов; headless verify (`npm run verify`)
- [x] UI/UX: прогресс загрузки проекта, история сцен ←/→, память камеры per-scene,
      ресайз панели, tooltip пути, drag-and-drop порядка сцен, фикс aspect canvas,
      дефолт arrival pitch=0 + флаг `arrivalSet` с предупреждениями ⚠
- [ ] Сборка portable .exe проверена end-to-end (`npm run build:exe`)

**Браузерный MVP (история):**

**Что сделано:**
- [x] Инициализирован monorepo (root package.json + workspaces)
- [x] Создан пакет `tiler` — полностью реализован, флаг `--mobile`
- [x] Исправлен `preview.jpg`: теперь вертикальный стрип 256×1536 (6 граней в порядке bdflru)
- [x] Исправлен `manifest.json`: поле `sceneId` вместо `id`; editor принимает оба
- [x] Создан пакет `editor` — полностью реализован
- [x] `src/store/types.ts` — все TypeScript-типы схемы тура
- [x] `src/store/tourStore.tsx` — Context + useReducer, 13 actions
- [x] `PanoramaList` — загрузка файлов, список сцен
- [x] `PanoramaCanvas` — Marzipano EquirectGeometry, клик → yaw/pitch, маркеры хотспотов,
      overlay с текущим yaw/pitch/fov, кнопка "Capture view"
- [x] `SceneSettings` — название сцены, initialView, tilesPath, импорт manifest.json
- [x] `PanoramaList` — ☆/★ кнопка выбора дефолтной сцены
- [x] `HotspotPanel` — чекбокс "Auto-flip arrival yaw" (по умолчанию включён)
- [x] `NavHotspotForm` — поля targetYaw/Pitch/Fov, кнопка "Apply" из capturedView
- [x] `InfoHotspotForm` — поля title, text, imageUrl, videoUrl
- [x] `exporter.ts` + `zipper.ts` — сериализация, ZIP с viewer-файлами, экспорт в папку
- [x] `serverApi.ts` — транспортная абстракция: `checkServer`, `tileOnServer`, `fetchTileFiles`
- [x] `zipper.ts` — `downloadZipWithTiles()`: полный ZIP тура с тайлами с локального сервера
- [x] `SceneSettings` — кнопка "Tile on server ▶", статус сервера, авто-заполнение levels
- [x] Создан пакет `server` — Express, `POST /api/tile`, `GET /tiles/*`, `GET /viewer/*`
- [x] `npm run dev` — запускает server + editor одновременно через concurrently
- [x] Создан пакет `viewer` — полностью реализован
- [x] Реализован базовый viewer (Фаза 1)
- [x] Реализован `TransitionEngine` (Фаза 2, без фазы приземления)
- [x] Реализована `InfoPanel` (Фаза 3)
- [x] Кiosk IPC: `i18n.js` (uz/ru/en), кнопка выхода, `TOUR_EXIT` postMessage
- [x] Навигация по `?scene=sceneId` (URL) и `TOUR_NAVIGATE` (postMessage)
- [x] Beacon `TOUR_ACTIVITY`: throttle 2500 мс, capture-фаза, только в iframe
- [x] Диагностический лог: `?debug=1` → `[panotour]` в консоль (параметры загрузки, TOUR_EXIT с причиной, TOUR_ACTIVITY)
- [x] YouTube офлайн-заглушка в InfoPanel (`navigator.onLine` + `t('video.offline')` + `.info-panel-offline`)
- [x] Escape в InfoPanel: `stopImmediatePropagation` — изолирован от TOUR_EXIT независимо от порядка обработчиков
- [x] Исправлен zoom: лимитер FOV, scroll wheel RAF, pinch-to-zoom
- [x] Хотспоты масштабируются с FOV (`--hs-scale`); nav-хотспоты — эллипсы на полу
- [ ] Протестирован полный цикл: pano → tiler → editor → export → viewer

**Следующий шаг:**
1. Очередь UI/UX: U.6 (Go to target scene), U.7 (валидация arrival при экспорте),
   U.8 (горячие клавиши), U.9 (память окна), U.10 (индикатор несохранённого)
2. Медиафайлы info-хотспотов: IPC `media:copy` → `media/` (сейчас только URL)
3. Сборка и проверка portable .exe (`npm run build:exe`, Windows x64)
4. Интеграция с киоском по `docs/kiosk-map-linking.md`

**Известное ограничение редактора:**
`PanoramaCanvas` загружает полное equirectangular-изображение как одну текстуру
(`EquirectGeometry`), без тайлинга. Для больших файлов (8192px+) возможна высокая
нагрузка на VRAM. Приемлемо для десктопного инструмента; оптимизация — в backlog.

---

## Открытые вопросы

1. `view.screenToCoordinates({x,y})` — **подтверждён** по исходнику `marzipano.js` v0.10.2.
   Реализован в `RectilinearView` и `FlatView`. Используется в `PanoramaCanvas.tsx`.
2. File System Access API (`showDirectoryPicker`) — поддержка только Chrome/Edge.
   **Решено:** реализован graceful fallback — в Firefox кнопка "→ Folder" автоматически
   вызывает `downloadZip()`.
3. Тайлинг в браузере (без Node.js tiler) — **не планируется** (см. ADR-001):
   требует COOP/COEP заголовков, что ломает YouTube iframe в InfoPanel.
4. Лицензия на использование Marzipano внутри редактора: Apache 2.0, коммерческое
   использование разрешено. Проверено.
